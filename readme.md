### swagger-to-ts-schema

命令参数：
url：swagger路径 或 配置json文件
className：api命名空间，默认为$api
output：输出的文件路径 默认为 ./
fileName：输出的文件名称，默认为 api
force：是否强制覆盖文件
debug：debug模式
type：
1. schema：默认，输出所有api
2. valid：只生成项目内已使用的api

~~schemaType = "json", // 输出的模式~~

##### 生成命令
```
node node_modules/swagger-to-ts-schema url=./build/bin/swagger-dev.json output=./src/api force
```
##### swagger配置文件
```json
{
    "swagger": [
        {
            "url": "http://127.0.0.1:8888/swagger-ui.html#/",
            "namespace": "test",
            "description": "test描述信息"
        },
        {
            "url": "http://127.0.0.1:9999/swagger-ui.html#/",
            "namespace": "base",
            "description": "base描述信息"
        },
    ]
}
```