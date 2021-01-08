const _ = require("lodash");
const ts = require("./util");

// 有效的请求方法
const AuthorizedMethods = [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    // "PATCH",
    "COPY",
    // "HEAD",
    // "OPTIONS",
    "LINK",
    "UNLIK",
    "PURGE",
    "LOCK",
    "UNLOCK",
    "PROPFIND",
];

// 获得驼峰命名
const getClassName = function (name) {
    name = name.replace(/-Api|-controller|\./gi, "");
    name = name.replace(/\s{1}/gi, "-");
    var parts = name.split("-");
    var className = [];
    _.each(parts, function (part) {
        var words = part.toLowerCase().split("");
        for (var i = 0; i < words.length; i++) {
            className.push(i == 0 ? words[i].toUpperCase() : words[i]);
        }
    });
    return className.join("");
};

// 检查是否为有效的分组名，不能出现中文
const isValidGroupName = (str) => {
    for (let i = 0; i < str.length; i++) {
        if (str.charCodeAt(i) > 255) {
            return false;
        }
        return true;
    }
};

// 规范化接口名称
const normalizeName = function (id) {
    return id.replace(/\.|\-|\{|\}|\s/g, "_");
};

// 通过路径名获取方法名称
const getPathToMethodName = function (m, path) {
    // 根路径直接返回请求方法名
    if (path === "/" || path === "") {
        return m;
    }

    // Clean url path for requests ending with '/'
    var cleanPath = path.replace(/\/$/, "");

    var segments = cleanPath.split("/").slice(1);
    segments = _.transform(segments, function (result, segment) {
        if (segment[0] === "{" && segment[segment.length - 1] === "}") {
            segment = "by" + segment[1].toUpperCase() + segment.substring(2, segment.length - 1);
        }
        result.push(segment);
    });
    var result = _.camelCase(segments.join("-"));
    return m.toLowerCase() + result[0].toUpperCase() + result.substring(1);
};

const getApiNameApplyMethod = function (method, path) {
    // 根目录直接返回方法名
    if (path === "/" || path === "") {
        return `_${method}`;
    }

    let lastPath = path.split("/").slice(-1)[0];
    return _.camelCase(lastPath) + "_" + method.toLowerCase();
};

// 根据swapper标题获取命名空间
const getSwapperNamespace = function (title) {
    if (typeof title !== "string" || !title) throw new Error("swapper title is not exist");
    // 移除中文
    let _title = title.replace(/\p{Unified_Ideograph}/gu, "");
    // 转为驼峰命名
    return getClassName(_title);
};

// 根据字符串key从对象中取值，无key值自动创建
const getStrkeyFromObj = function (obj, strKey = "", separator = ".") {
    if (!strKey) return obj;
    let keys = strKey.split(separator);
    let target = obj;
    keys.forEach((key) => {
        target[key] = target[key] || {};
        target = target[key];
    });
    return target;
};

const getViewForSwagger = function (opts) {
    const swagger = opts.swagger;
    if (!swagger.info) throw new Error("swagger is not exist");
    // 标题
    const namespace = opts.namespace || getSwapperNamespace(swagger.info.title);
    const $swagger = {
        namespace,
        description: opts.description || swagger.info.description, // 该接口的描述信息
        // isSecure: swagger.securityDefinitions !== undefined, // 接口的验证信息
        moduleName: opts.moduleName,
        className: opts.className || "$api",
        imports: opts.imports,
        domain: swagger.host && swagger.basePath
                ? (swagger.schemes && swagger.schemes.length ? swagger.schemes[0] : 'http') + "://" + swagger.host + swagger.basePath.replace(/\/+$/g, "")
                : "", // swagger域名
        url: '', // swagger路径
        apis: [], // 接口方法
        definitions: [], // 类型定义
        pathGroups: {},
        parentGroups: {},
    };

    // 构造swagger路径
    if ($swagger.domain) {
        $swagger.url = $swagger.domain + '/swagger-ui.html#';
    }

    // 接口方法
    const API_NAME_SET = new Set();
    // 标签MAP
    const TAGS_MAP = new Map();
    // api名称MAP
    const API_NAME_MAP = new Map();
    // 将tags的名称和描述做map
    for (let tag of swagger.tags) {
        // 为兼容后端name设为英文的问题
        const name = getClassName(tag.name);
        const desc = getClassName(tag.description);
        TAGS_MAP.set(name, desc);
        TAGS_MAP.set(desc, name);
    }

    // 遍历paths属性，构造api
    _.forEach(swagger.paths, (pathOpt, apiPath) => {
        // 接口的全局参数
        let $globalParams = [];
        for (let reqMethod in pathOpt) {
            if (reqMethod.toLowerCase() === "parameters") {
                $globalParams = pathOpt[reqMethod];
                break;
            }
        }

        // 遍历每个path的接口方法，已request method做key
        _.forEach(pathOpt, (apiOpt, reqMethod) => {
            // 将方法名转为大写
            let $reqMethod = reqMethod.toUpperCase();
            // 检查是否为支持的请求类型
            if (!$reqMethod || AuthorizedMethods.indexOf($reqMethod) === -1) return;

            // 构造接口的方法名，优先从路径中取 2020.11.25
            let $apiName = getPathToMethodName($reqMethod, apiPath);
            // let $apiName2 = apiOpt.operationId && normalizeName(apiOpt.operationId) || null;

            // 移除api名称的using
            $apiName = $apiName.replace(/Using.+$/, "");
            // 确保接口名称是唯一的
            if (API_NAME_SET.has($apiName)) {
                let i = 1;
                while (true) {
                    if (API_NAME_SET.has($apiName + "_" + i)) {
                        i++;
                    } else {
                        $apiName = $apiName + "_" + i;
                        break;
                    }
                }
            }
            API_NAME_SET.add($apiName);

            // 获得父路径，根路径为空字符串
            let parentPath = apiPath.replace(/^\//, "").split("/");
            parentPath.pop();
            parentPath = parentPath.join("/");

            // 构造api方法对象
            let $api = {
                path: apiPath,
                apiName: $apiName, // api方法名称
                apiNamex: getApiNameApplyMethod($reqMethod, apiPath),
                parentPath, // api的父路径
                method: $reqMethod, // 请求method
                isApi: true,
                isGET: $reqMethod === "GET",
                isPOST: $reqMethod === "POST",
                summary: apiOpt.description || apiOpt.summary, // 接口概要
                definitions: apiOpt.description || apiOpt.summary, // 接口明细，包含tag
                // externalDocs: op.externalDocs,
                // isSecure: swagger.security !== undefined || op.security !== undefined,
                // isSecureToken: secureTypes.indexOf("oauth2") !== -1,
                // isSecureApiKey: secureTypes.indexOf("apiKey") !== -1,
                // isSecureBasic: secureTypes.indexOf("basic") !== -1,
                parameters: [],
                headers: [],
                response: "object",
                group: null,
                uniquePath: ts.geSwagger2ApiUniquePath($swagger.url, apiOpt.tags, apiOpt.operationId)
            };

            // 从接口标签中取得标签信息
            if (Array.isArray(apiOpt.tags)) {
                for (let tag of apiOpt.tags) {
                    let name = getClassName(tag);
                    let desc = TAGS_MAP.get(name);
                    if (!desc) continue;
                    // 兼容后端讲tag key设为中文
                    $api.group = (isValidGroupName(name) && name) || (isValidGroupName(desc) && desc) || null;
                    $api.definitions = `${name} ${desc} ${$api.definitions}`;
                    if (!$api.group) console.log("分组名称不合法");
                    break;
                }
            }

            // 该api存在分组
            if ($api.group) {
                if (!API_NAME_MAP.has($api.group)) {
                    API_NAME_MAP.set($api.group, new Set());
                }

                // 确保api名称是唯一的
                if (API_NAME_MAP.get($api.group).has($apiName)) {
                    // api名称重复，则在尾部补上序号
                    let i = 1;
                    while (true) {
                        if (API_NAME_SET.has($apiName + "_" + i)) {
                            i++;
                        } else {
                            $apiName = $apiName + "_" + i;
                            break;
                        }
                    }
                }
                $api.apiName = $apiName;
                API_NAME_MAP.get($api.group).add($apiName);
            }

            // 补全接口的请求头
            let produces = apiOpt.produces || swagger.produces;
            if (produces) {
                $api.headers.push({
                    name: "Accept",
                    value: `'${produces
                        .map(function (value) {
                            return value;
                        })
                        .join(", ")}'`,
                });
            }

            let consumes = apiOpt.consumes || swagger.consumes;
            if (consumes) {
                $api.headers.push({
                    name: "Content-Type",
                    value: "'" + consumes + "'",
                });
            }

            // 接口的返回值，只获取成功的返回值
            let responses = apiOpt.responses;
            if (responses && responses["200"]) {
                let responseSchema = responses["200"].schema;
                // 获取返回值的定义
                if (responseSchema && _.isString(responseSchema.$ref)) {
                    let segments = responseSchema.$ref.split("/");
                    $api.response = ts.normalizeTypeName(segments.length === 1 ? segments[0] : segments[2]);
                }
            }

            // 请求参数
            let params = [];
            if (_.isArray(apiOpt.parameters)) {
                params = apiOpt.parameters;
            }
            params = params.concat($globalParams);
            params.forEach(($param) => {
                if ($param["x-exclude-from-bindings"] === true) {
                    return;
                }

                if (_.isString($param.$ref)) {
                    let segments = $param.$ref.split("/");
                    $param = swagger.parameters[segments.length === 1 ? segments[0] : segments[2]];
                }

                // 生产参数的驼峰命名
                $param.camelCaseName = _.camelCase($param.name);

                // 枚举值类型
                if ($param.enum && $param.enum.length === 1) {
                    $param.isSingleton = true;
                    $param.singleton = $param.enum[0];
                }
                if ($param.in === "body") {
                    $param.isBodyParameter = true;
                } else if ($param.in === "path") {
                    $param.isPathParameter = true;
                } else if ($param.in === "query") {
                    if ($param["x-name-pattern"]) {
                        $param.isPatternType = true;
                        $param.pattern = $param["x-name-pattern"];
                    }
                    $param.isQueryParameter = true;
                } else if ($param.in === "header") {
                    $param.isHeaderParameter = true;
                } else if ($param.in === "formData") {
                    $param.isFormParameter = true;
                }
                $param.tsType = ts.convertType($param);

                // 参数是否是可选的
                $param.cardinality = $param.required ? "" : "?";
                $api.parameters.push($param);
            });

            // api请求参数是否都放在body里
            $api.isBodyParameter =
                ($api.parameters.length &&
                    $api.parameters.filter((p) => p.isBodyParameter).length === $api.parameters.length) ||
                false;
            // api请求参数是否都放在path里
            $api.isPathParameter = ($api.parameters.length &&
                $api.parameters.filter((p) => p.isPathParameter).length === $api.parameters.length) ||
            false;

            // 讲api添加进结果
            $swagger.apis.push($api);

            // 根据swagger tag分组
            // if ($api.group) {
            //     $swagger.apiGroups = $swagger.apiGroups || {};
            //     $swagger.apiGroups[$api.group] = $swagger.apiGroups[$api.group] || {
            //         description: `${$api.group} ${TAGS_MAP.get($api.group)}`, // 分组描述信息
            //         items: [],
            //     };

            //     // api分组
            //     $swagger.apiGroups[$api.group].items.push($api);
            // }

            // 根据服务器路径分组
            // let $apiPaths = $api.path.replace(/^\//, "").split("/");
            // $apiPaths.reduce((map, key, index) => {
            //     if (index !== $apiPaths.length - 1) {
            //         map[key] = map[key] || {};
            //     } else {
            //         map[$api.apiNamex] = $api;
            //     }
            //     return map[key];
            // }, $swagger.pathGroups);
        });
    });

    // 根据父路径进行分组
    $swagger.apis.forEach((apiObj) => {
        let groups = getStrkeyFromObj($swagger.parentGroups, apiObj.parentPath, "/");
        if (!groups.items) {
            groups.items = [];
        }
        groups.items.push(apiObj);
    });

    // 遍历definitions属性，构造ts的interface
    _.forEach(swagger.definitions, function (definition, name) {
        $swagger.definitions.push({
            name: ts.normalizeTypeName(name), // 名称
            description: definition.description, // 描述信息
            tsType: ts.convertType(definition, swagger), // ts类型
        });
    });

    return $swagger;
};

module.exports = {
    getViewForSwagger
};
