const _ = require("lodash");
const inquirer = require("inquirer");
const fs = require("fs");

// 奖名称规范化，泛型尖括号和逗号转为下划线
const normalizeTypeName = function (id) {
    return id.replace(/«|»|,/g, "_");
};

// 转为typescript支持的类型
function convertType(swaggerType, swagger) {
    var typespec = {
        description: swaggerType.description,
        isEnum: false,
    };

    if (swaggerType.hasOwnProperty("schema")) {
        return convertType(swaggerType.schema);
    }
    let _swaggerType = typeof swaggerType.type === "string" && swaggerType.type.toLowerCase();
    if (_.isString(swaggerType.$ref)) {
        typespec.tsType = "ref";
        // typespec.target = swaggerType.$ref.substring(swaggerType.$ref.lastIndexOf("/") + 1);
        let segments = swaggerType.$ref.split("/");
        typespec.target = normalizeTypeName(segments.length === 1 ? segments[0] : segments[2]);
    } else if (swaggerType.hasOwnProperty("enum")) {
        typespec.tsType = swaggerType.enum
            .map(function (str) {
                return "'" + str + "'";
            })
            .join(" | ");
        typespec.isAtomic = true;
        typespec.isEnum = true;
    } else if (_swaggerType === "string") {
        typespec.tsType = "string";
    } else if (_swaggerType === "number" || _swaggerType === "integer") {
        typespec.tsType = "number";
    } else if (_swaggerType === "boolean") {
        typespec.tsType = "boolean";
    } else if (_swaggerType === "array") {
        typespec.tsType = "array";
        typespec.elementType = convertType(swaggerType.items);
    } else {
        /* If (swaggerType.type === 'object') */
        if (swaggerType.minItems >= 0 && swaggerType.hasOwnProperty("title") && !swaggerType.$ref) {
            typespec.tsType = "any";
        } else {
            typespec.tsType = "object";
            typespec.properties = [];
            if (swaggerType.allOf) {
                _.forEach(swaggerType.allOf, function (ref) {
                    if (ref.$ref) {
                        var refSegments = ref.$ref.split("/");
                        var name = refSegments[refSegments.length - 1];
                        _.forEach(swagger.definitions, function (definition, definitionName) {
                            if (definitionName === name) {
                                var property = convertType(definition, swagger);
                                Array.prototype.push.apply(typespec.properties, property.properties);
                            }
                        });
                    } else {
                        var property = convertType(ref);
                        Array.prototype.push.apply(typespec.properties, property.properties);
                    }
                });
            }

            // 解析object的属性
            _.forEach(swaggerType.properties, function (propertyType, propertyName) {
                var property = convertType(propertyType);
                property.name = propertyName;

                property.optional = true;
                if (swaggerType.required && swaggerType.required.indexOf(propertyName) !== -1) {
                    property.optional = false;
                }

                typespec.properties.push(property);
            });
        }
    }

    typespec.isRef = typespec.tsType === "ref";
    typespec.isObject = typespec.tsType === "object";
    typespec.isArray = typespec.tsType === "array";
    typespec.isAtomic = typespec.isAtomic || _.includes(["string", "number", "boolean", "any"], typespec.tsType);

    return typespec;
}

// 根据字符串路径
function createObjectByStringKey(strKey = "", obj = {}) {
    let keys = strKey.split(".");
    let target = obj;
    keys.forEach((key) => {
        target[key] = target[key] || {};
        target = target[key];
    });
    return obj;
}

/* 工具方法 */
function _error(msg) {
    console.error('\x1b[91m', msg);
}

function _info(msg) {
    console.log('\x1b[32m', msg);
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

// 根据swagger的tag和operationId生成api唯一路径
function geSwagger2ApiUniquePath(swaggerUrl, tags, operationId) {
    if (!swaggerUrl || !Array.isArray(tags) || !operationId) return "";
    const paths = [...tags, operationId];

    return swaggerUrl + "/" + paths.map(path => {
        return path.toString().replace(/[^a-zA-Z\d]/g, function (e) {
            return e.charCodeAt(0)
        });
    }).join("/");
}

module.exports = {
    convertType,
    normalizeTypeName,
    createObjectByStringKey,
    _error,
    _info,
    saveFile,
    geSwagger2ApiUniquePath
};
