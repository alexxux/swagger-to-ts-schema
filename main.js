const generatorApiSchema = require("./src/generator/generatorApiSchema.js");
const generatorValidApiSchema = require("./src/generator/generatorValidApiSchema.js");

const ActionTypeMap = {
    schema: generatorApiSchema,
    valid: generatorValidApiSchema
}

// 取出命令行的参数
let props = global.process.argv.slice(2);
props = props.reduce((map, item) => {
    let [key, value] = item.split("=");
    map[key] = value || true;
    return map;
}, {});

let { type = "schema" } = props;

typeof ActionTypeMap[type] === "function" && ActionTypeMap[type](props);






