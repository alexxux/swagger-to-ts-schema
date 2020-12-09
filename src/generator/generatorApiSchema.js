const fs = require("fs");
const path = require("path");
const ejs = require("ejs");
const axios = require("axios");
const beautify = require("js-beautify").js;
const codegen = require("../codegen");
const _error = require("../util")._error;
const _info = require("../util")._info;
const saveFile = require("../util").saveFile;

// 解析swagger路径
function getSwaggerJson(url) {
    if (url.includes("swagger-ui.html")) {
        return url.replace("swagger-ui.html", "v2/api-docs?group=Default");
    }
    return url;
}

// 构造d.ts已经api描述文件
async function generatorApiSchema(props) {
    let { url, // 接口文件
        className = "$api", // 接口命名空间
        output = "./", // 输出的文件路径
        fileName = "api", // 输出的文件名称
        force, // 是否强制覆盖文件
        debug, // debug模式
        schemaType = "json", // 输出的模式
    } = props;

    // d.ts模板文件
    const apiDtsTmp = fs.readFileSync(path.resolve(__dirname, "../templates/apis.d.ejs"), "utf-8");
    // schema模板文件
    const schemaTmpMap = {
        json: "../templates/apisjson.ejs",
        js: "../templates/apis.ejs",
    }
    // const apiTmp = fs.readFileSync(path.resolve(__dirname, "./src/templates/apis.ejs"), "utf-8");
    const apiTmp = fs.readFileSync(path.resolve(__dirname, schemaTmpMap[schemaType]), "utf-8");

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
        await saveFile(`${output}${fileName}.d.ts`, beautify($apiDts), force);
        await saveFile(`${output}${fileName}.${schemaType}`, beautify($api), force);

        if (debug) {
            _info("=== debug模式：输出转译文件 ===");
            saveFile(`${output}swaggerData.json`, beautify(JSON.stringify(swaggerData)), force);
        }
    } catch (e) {
        _error("swagger请求异常", e);
    }
}

module.exports = generatorApiSchema