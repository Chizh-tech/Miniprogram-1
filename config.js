/**
 * 配置文件 - 请在此处填写您的 API 密钥
 *
 * 天气 API：本项目使用 OpenWeatherMap API
 *   - 免费注册：https://openweathermap.org/api
 *   - 注册后获取 API Key 并填写到 WEATHER_API_KEY
 *   - 同时需要在微信小程序后台配置合法域名：api.openweathermap.org
 *
 * 腾讯位置服务（反向地理编码）：
 *   - 申请地址：https://lbs.qq.com/
 *   - 获取 WebService API Key 并填写到 TENCENT_MAP_KEY
 *   - 同时需要在微信小程序后台配置合法域名：apis.map.qq.com
 */
const config = {
  // OpenWeatherMap API Key（用于获取天气信息）
  WEATHER_API_KEY: '',

  // 腾讯地图 API Key（用于反向地理编码，获取地址名称）
  TENCENT_MAP_KEY: '',

  // 天气 API 地址
  WEATHER_API_URL: 'https://api.openweathermap.org/data/2.5/weather',

  // 腾讯地图反向地理编码 API
  GEOCODING_API_URL: 'https://apis.map.qq.com/ws/geocoder/v1/'
};

module.exports = config;
