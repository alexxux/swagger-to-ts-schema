const fs = require("fs");
const util = require("../util.js");
const path = require("path");
const generatorApiSchema = require("./generatorApiSchema.js");
// 根据命名空间生成
function getApiRegExp(className) {
    if (typeof className !== "string" || !className) throw new Error("api className is invalid");
    let translationRegKey = [`$`, "."];
    translationRegKey.forEach(key => {
        let regStr = `\\${key}`;
        className = className.replace(new RegExp(regStr, "g"), regStr);
    })
    return new RegExp(`${className}(\\.\\w+(\\n(\\s|\\t)*)*)+`, "g")
}

// 过滤并导出有效使用的apiSchema
async function generatorValidApiSchema(props) {
    let { scopeDir = "./src", // 需要遍历筛选的目录
        className = "$api", // 接口命名空间
    } = props;

    // 构造api方法的正则表达式对象
    const apiFnReg = getApiRegExp(className);
    // 递归遍历文件路径，获取使用的api接口
    function getApiMap(filePath, map = {}) {
        //根据文件路径读取文件，返回文件列表
        let files = fs.readdirSync(filePath);
        //遍历读取到的文件列表
        files.forEach(function (filename) {
            //获取当前文件的绝对路径
            var filedir = path.join(filePath, filename);
            //根据文件路径获取文件信息，返回一个fs.Stats对象
            let stats = fs.statSync(filedir);
            if (stats.isFile()) {
                // d.ts文件不检查
                if (filedir.endsWith("d.ts")) return;
                let code = fs.readFileSync(filedir, "utf-8");
                    // 过滤代码内的tab
                    code = code.replace(/(\t)+/g, "");
                // 根据命名空间匹配api
                let apiFns = code.match(apiFnReg);
                if (!apiFns) return;

                apiFns.forEach(api => {
                    // util.createObjectByStringKey(api, map)
                    if (map[api]) {
                        map[api]++
                    } else {
                        map[api] = 1;
                    }
                })
            } else if (stats.isDirectory()) {
                return getApiMap(filedir, map);//递归，如果是文件夹，就继续遍历该文件夹下面的文件
            }
        });
        return map;
    }

    const validApiMap = getApiMap(scopeDir);
    const validApiValues = typeof validApiMap === "object" && Object.values(validApiMap) || [];

    if (!validApiValues.length) return util._error("=== 无有效API ===");
    let apiCounts = validApiValues.reduce((counts, num) => {
        counts += num;
        return counts;
    }, 0);

    util._info(`=== 已使用API（${validApiValues.length}），引用API次数（${apiCounts}）===`);
    return generatorApiSchema({
        ...props,
        validApiMap
    })
}

module.exports = generatorValidApiSchema