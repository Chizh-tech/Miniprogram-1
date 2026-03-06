/**
 * 天气服务
 * 使用 OpenWeatherMap API 获取天气信息
 * 需要在 config.js 中配置 WEATHER_API_KEY
 * 并在小程序后台添加合法域名：api.openweathermap.org
 */

const config = require('../config');

/**
 * 天气图标映射（OpenWeatherMap 天气代码 → emoji）
 */
const WEATHER_ICON_MAP = {
  '01d': '☀️', '01n': '🌙',
  '02d': '⛅', '02n': '⛅',
  '03d': '☁️', '03n': '☁️',
  '04d': '☁️', '04n': '☁️',
  '09d': '🌧️', '09n': '🌧️',
  '10d': '🌦️', '10n': '🌦️',
  '11d': '⛈️', '11n': '⛈️',
  '13d': '❄️', '13n': '❄️',
  '50d': '🌫️', '50n': '🌫️'
};

/**
 * 天气描述翻译（英文 → 中文）
 */
const WEATHER_DESC_MAP = {
  'clear sky': '晴天',
  'few clouds': '少云',
  'scattered clouds': '多云',
  'broken clouds': '阴云',
  'overcast clouds': '阴天',
  'light rain': '小雨',
  'moderate rain': '中雨',
  'heavy intensity rain': '大雨',
  'very heavy rain': '暴雨',
  'extreme rain': '特大暴雨',
  'light snow': '小雪',
  'moderate snow': '中雪',
  'heavy snow': '大雪',
  'thunderstorm': '雷暴',
  'thunderstorm with light rain': '雷阵雨',
  'drizzle': '细雨',
  'mist': '薄雾',
  'fog': '大雾',
  'haze': '雾霾',
  'dust': '扬沙',
  'sand': '沙尘'
};

/**
 * 将英文天气描述翻译为中文
 * @param {string} desc
 * @returns {string}
 */
function translateWeatherDesc(desc) {
  return WEATHER_DESC_MAP[desc.toLowerCase()] || desc;
}

/**
 * 获取天气信息
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<Object>}
 */
function getWeather(latitude, longitude) {
  return new Promise((resolve, reject) => {
    if (!config.WEATHER_API_KEY) {
      // 未配置 API Key 时返回模拟数据
      resolve(getMockWeather());
      return;
    }

    wx.request({
      url: config.WEATHER_API_URL,
      data: {
        lat: latitude,
        lon: longitude,
        appid: config.WEATHER_API_KEY,
        units: 'metric',
        lang: 'zh_cn'
      },
      success(res) {
        if (res.statusCode === 200 && res.data) {
          const data = res.data;
          const weatherItem = data.weather[0];
          const icon = WEATHER_ICON_MAP[weatherItem.icon] || '🌤️';
          const desc = translateWeatherDesc(weatherItem.description);
          resolve({
            text: desc,
            temperature: Math.round(data.main.temp),
            icon,
            humidity: data.main.humidity,
            windSpeed: data.wind ? data.wind.speed : 0
          });
        } else {
          resolve(getMockWeather());
        }
      },
      fail() {
        resolve(getMockWeather());
      }
    });
  });
}

/**
 * 返回模拟天气数据（当 API Key 未配置时使用）
 * @returns {Object}
 */
function getMockWeather() {
  return {
    text: '天气获取失败',
    temperature: '--',
    icon: '🌤️',
    humidity: '--',
    windSpeed: '--'
  };
}

module.exports = {
  getWeather
};
