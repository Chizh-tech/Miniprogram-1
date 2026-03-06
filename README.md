# 日记小程序

一个功能完整的微信小程序日记应用。

## 功能特性

- 📅 **内置日历** — 月视图日历，有日记的日期带有标记，支持切换月份
- ✏️ **写日记** — 支持标题、正文，可添加图片和视频
- 📷 **上传图片** — 从相册或相机选取，最多9张，文件永久保存
- 🎬 **上传视频** — 从相册或相机选取，最多3段（每段限60秒），文件永久保存
- 📍 **自动记录位置** — 自动获取当前地理位置并显示地址名称
- 🌤️ **自动记录天气** — 自动获取当前位置的实时天气信息
- 📋 **日记列表** — 支持日历视图和列表视图切换
- 🗑️ **编辑/删除** — 随时修改或删除日记记录

## 项目结构

```
├── app.js                  # 应用入口
├── app.json                # 全局配置
├── app.wxss                # 全局样式
├── config.js               # API 密钥配置
├── project.config.json     # 项目配置
├── sitemap.json            # 站点地图
├── utils/
│   ├── util.js             # 工具函数（日期处理、日历生成等）
│   ├── storage.js          # 日记数据存储服务
│   ├── weather.js          # 天气 API 服务
│   └── location.js         # 位置服务（含反向地理编码）
└── pages/
    ├── index/              # 首页（日历 + 列表）
    ├── edit/               # 编辑/新建日记页
    └── detail/             # 日记详情页
```

## 快速开始

1. 使用[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)打开本项目
2. 在 `config.js` 中配置 API 密钥（可选，不配置时位置显示坐标、天气显示获取失败）
3. 在小程序后台配置合法域名（如使用天气和地图 API）
4. 编译运行

## API 配置说明

编辑 `config.js` 文件：

```js
const config = {
  // OpenWeatherMap API Key（用于获取天气）
  // 免费注册：https://openweathermap.org/api
  WEATHER_API_KEY: '你的 Key',

  // 腾讯地图 API Key（用于反向地理编码）
  // 申请地址：https://lbs.qq.com/
  TENCENT_MAP_KEY: '你的 Key',
};
```

同时需要在**微信小程序后台 → 开发 → 开发设置 → 服务器域名**中添加：
- `api.openweathermap.org`（天气 API）
- `apis.map.qq.com`（腾讯地图 API）

> **注意**：不配置 API 密钥时，位置将显示经纬度坐标，天气将显示"天气获取失败"，其余所有功能正常使用。

## 数据存储

日记数据使用微信本地存储（`wx.storage`）保存在用户设备上，图片和视频文件保存在小程序的用户数据目录中。

