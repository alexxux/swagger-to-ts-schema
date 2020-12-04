"use strict";

var _ = require("lodash");

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

module.exports = {
    convertType,
    normalizeTypeName,
};
