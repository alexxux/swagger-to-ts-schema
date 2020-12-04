const ejs = require("ejs");
const fs = require("fs");
const path = require("path");
const inquirer = require("inquirer");
const axios = require("axios");
const codegen = require("./src/codegen");

(async () => {

    // 取出命令行的参数
    let props = global.process.argv.slice(2);
    props = props.reduce((map, item) => {
        let [key, value] = item.split("=");
        map[key] = value || true;
        return map;
    }, {});

    let { url, // 接口文件
        className = "$api", // 接口命名空间
        output = "./", // 输出的文件路径
        fileName = "api", // 输出的文件名称
        force, // 是否强制覆盖文件
        debug // debug模式
    } = props;

    // d.ts模板文件
    const apiDtsTmp = fs.readFileSync(path.resolve(__dirname, "./src/templates/apis.d.ejs"), "utf-8");
    // ts模板文件
    const apiTmp = fs.readFileSync(path.resolve(__dirname, "./src/templates/apis.ejs"), "utf-8");

    // 补上路径
    output = (output.endsWith("/") && output) || output + "/";

    if (!url) return _error("配置文件不能为空");
    if (!apiDtsTmp || !apiTmp) return _error("模板文件为空");

    // 请求接口
    let urls = [];
    // 解析配置文件
    try {
        let json = JSON.parse(fs.readFileSync(url, "utf-8"));
        json.swagger.forEach((s) => {
            urls.push({
                ...s,
                url: getSwaggerJson(s.url),
            });
        });
    } catch (e) {
        _error("解析配置文件失败", e);
    }

    if (!urls.length) return _error("无有效配置");

    let actions = urls.map((swagger) => {
        return new Promise((resolve) => {
            axios.get(swagger.url).then((res) => {
                resolve({
                    ...swagger,
                    data: res.data,
                });
            });
        });
    });

    _info("=== 开始生成swagger api文件 ===");
    _info(`=== 命名空间 ${className}`);
    _info(`=== 文件名称 ${fileName}`);
    _info(`=== 输出目录 ${output}`);


    try {
        let responses = await Promise.all(actions);
        let swaggerData = [];
        responses.forEach((res) => {
            swaggerData.push(
                codegen.getViewForSwagger({
                    ...res,
                    swagger: res.data,
                    className,
                })
            );
        });

        _info("=== 开始转换 ===");
        const $apiDts = ejs.render(apiDtsTmp, { swaggerData });
        const $api = ejs.render(apiTmp, { swaggerData });
        // 检查文件是否存在
        await saveFile(`${output}${fileName}.d.ts`, $apiDts, force);
        await saveFile(`${output}${fileName}.js`, $api, force);

        if (debug) {
            _info("=== debug模式：输出转译文件 ===");
            saveFile(`${output}swaggerData.json`, JSON.stringify(swaggerData), force);
        }
    } catch (e) {
        _error("swagger请求异常", err);
    }

})();

/* 工具方法 */
function _error(msg) {
    console.error(msg);
}

function _info(msg) {
    console.log(msg);
}

// 解析swagger路径
function getSwaggerJson(url) {
    if (url.includes("swagger-ui.html")) {
        return url.replace("swagger-ui.html", "v2/api-docs?group=Default");
    }
    return url;
}

// 保存文件，文件存在会提醒
async function saveFile(filePath, fileData, force) {
    if (!force && fs.existsSync(filePath)) {
        let { confirm } = await inquirer.prompt([
            {
                name: "confirm",
                type: "confirm",
                message: `${filePath}已存在，是否覆盖？`,
            },
        ]);
        if (!confirm) return _info(`${filePath}未保存`);
    }


    try {
        fs.writeFileSync(filePath, fileData);
        _info(`${filePath} 保存成功`);
    } catch (e) {
        _error("文件保存失败", e);
    }
}
