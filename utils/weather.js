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
  return new Promise((resolve) => {
    if (!config.WEATHER_API_KEY) {
      // 未配置 API Key 时返回明确提示
      resolve(getMockWeather('未配置天气 Key', {
        ok: false,
        httpStatus: '-',
        apiCode: '-',
        apiMessage: 'missing key',
        networkError: '-'
      }));
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
        if (res.statusCode === 200 && res.data && res.data.weather && res.data.main) {
          const data = res.data;
          const weatherItem = data.weather[0];
          const icon = WEATHER_ICON_MAP[weatherItem.icon] || '🌤️';
          const desc = translateWeatherDesc(weatherItem.description);
          resolve({
            text: desc,
            temperature: Math.round(data.main.temp),
            icon,
            humidity: data.main.humidity,
            windSpeed: data.wind ? data.wind.speed : 0,
            debug: {
              ok: true,
              httpStatus: res.statusCode,
              apiCode: data.cod || 200,
              apiMessage: data.message || '',
              networkError: '-'
            }
          });
        } else {
          const apiCode = res && res.data ? res.data.cod : '-';
          const apiMessage = res && res.data ? (res.data.message || '') : '';
          let reason = '天气服务异常';
          if (res.statusCode === 401) {
            reason = '天气 Key 无效';
          } else if (res.statusCode === 403) {
            reason = '天气服务拒绝访问';
          } else if (apiCode === 401 || apiCode === '401') {
            reason = '天气 Key 无效';
          } else if (apiCode === 429 || apiCode === '429') {
            reason = '天气请求过于频繁';
          } else if (apiCode === 400 || apiCode === '400') {
            reason = '天气请求参数异常';
          }
          resolve(getMockWeather(reason, {
            ok: false,
            httpStatus: res.statusCode,
            apiCode,
            apiMessage: apiMessage || '-',
            networkError: '-'
          }));
        }
      },
      fail(err) {
        resolve(getMockWeather('天气请求网络失败', {
          ok: false,
          httpStatus: '-',
          apiCode: '-',
          apiMessage: '-',
          networkError: (err && err.errMsg) || 'request:fail'
        }));
      }
    });
  });
}

/**
 * 返回模拟天气数据（当 API Key 未配置时使用）
 * @returns {Object}
 */
function getMockWeather(reason, debug) {
  return {
    text: reason || '天气获取失败',
    temperature: '--',
    icon: '🌤️',
    humidity: '--',
    windSpeed: '--',
    debug: debug || {
      ok: false,
      httpStatus: '-',
      apiCode: '-',
      apiMessage: '-',
      networkError: '-'
    }
  };
}

module.exports = {
  getWeather,
  __DEBUG_HAS_WEATHER_KEY__: !!config.WEATHER_API_KEY
};
