/**
 * 位置服务
 * 获取用户当前位置和地址信息
 * 使用腾讯地图 API 进行反向地理编码
 * 需要在 config.js 中配置 TENCENT_MAP_KEY
 * 并在小程序后台添加合法域名：apis.map.qq.com
 */

const config = require('../config');

const TENCENT_STATUS_REASON_MAP = {
  120: '腾讯地图配额已用完或超出日调用限制',
  121: '腾讯地图 Key 未启用 WebService 或服务受限',
  311: '腾讯地图 Key 无效',
  312: '腾讯地图 Key 已过期或已停用',
  401: '腾讯地图请求参数错误',
  403: '腾讯地图请求被拒绝（域名白名单/签名/权限）'
};

/**
 * 获取当前位置信息（坐标 + 地址名称）
 * @returns {Promise<Object>}
 */
function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: 'gcj02',
      success(res) {
        const { latitude, longitude } = res;
        const coordinateName = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

        if (!config.TENCENT_MAP_KEY) {
          // 未配置 API Key，只返回坐标
          resolve({
            latitude,
            longitude,
            name: coordinateName,
            geocodeDebug: {
              ok: false,
              reason: '未配置地图 Key',
              httpStatus: '-',
              apiStatus: '-',
              apiMessage: '-',
              networkError: '-'
            }
          });
          return;
        }

        // 使用腾讯地图反向地理编码获取地址
        reverseGeocode(latitude, longitude)
          .then(result => {
            resolve({
              latitude,
              longitude,
              name: result.name || coordinateName,
              geocodeDebug: result.debug
            });
          })
          .catch((err) => {
            resolve({
              latitude,
              longitude,
              name: coordinateName,
              geocodeDebug: {
                ok: false,
                reason: '反向地理编码网络失败',
                httpStatus: '-',
                apiStatus: '-',
                apiMessage: '-',
                networkError: (err && err.message) || 'request:fail'
              }
            });
          });
      },
      fail(err) {
        const errMsg = (err && err.errMsg) || '';
        const isAuthDenied = errMsg.includes('auth deny') || errMsg.includes('authorize no response');
        reject({
          type: isAuthDenied ? 'AUTH_DENIED' : 'LOCATION_FAILED',
          message: isAuthDenied ? '位置权限未开启' : '定位失败',
          raw: err
        });
      }
    });
  });
}

function buildCoordinateName(latitude, longitude) {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

function mapTencentErrorReason(apiStatus, apiMessage, httpStatus) {
  if (TENCENT_STATUS_REASON_MAP[apiStatus]) {
    return TENCENT_STATUS_REASON_MAP[apiStatus];
  }

  if (httpStatus === 401) return '腾讯地图鉴权失败（401）';
  if (httpStatus === 403) return '腾讯地图访问被拒绝（403）';
  if (httpStatus === 429) return '腾讯地图请求过于频繁（429）';
  if (httpStatus >= 500) return '腾讯地图服务异常';
  if (apiMessage) return `腾讯地图返回异常：${apiMessage}`;
  return '反向地理编码返回异常';
}

async function reverseGeocode(latitude, longitude) {
  const coordinateName = buildCoordinateName(latitude, longitude);
  const tencentResult = await reverseGeocodeByTencent(latitude, longitude);

  if (tencentResult.debug && tencentResult.debug.ok) {
    return tencentResult;
  }

  if (!config.WEATHER_API_KEY) {
    return tencentResult;
  }

  const weatherResult = await reverseGeocodeByOpenWeather(latitude, longitude);
  if (weatherResult.debug && weatherResult.debug.ok) {
    const fallbackMessage = weatherResult.debug.apiMessage || weatherResult.debug.reason || 'fallback ok';
    return {
      name: weatherResult.name || coordinateName,
      debug: {
        ok: true,
        reason: '地址解析成功（备用服务）',
        httpStatus: tencentResult.debug ? tencentResult.debug.httpStatus : '-',
        apiStatus: tencentResult.debug ? tencentResult.debug.apiStatus : '-',
        apiMessage: `${tencentResult.debug && tencentResult.debug.apiMessage ? tencentResult.debug.apiMessage : '-'} | fallback:${fallbackMessage}`,
        networkError: '-'
      }
    };
  }

  return tencentResult;
}

/**
 * 腾讯地图反向地理编码
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<string>} 地址名称
 */
function reverseGeocodeByTencent(latitude, longitude) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: config.GEOCODING_API_URL,
      data: {
        location: `${latitude},${longitude}`,
        key: config.TENCENT_MAP_KEY,
        output: 'json'
      },
      success(res) {
        if (res.statusCode === 200 && res.data && res.data.status === 0) {
          const result = res.data.result;
          const address = result.formatted_addresses
            ? result.formatted_addresses.recommend
            : result.address;
          const city = result.address_component ? result.address_component.city : '';
          resolve({
            name: address || city || buildCoordinateName(latitude, longitude),
            debug: {
              ok: true,
              reason: '反向地理编码成功',
              httpStatus: res.statusCode,
              apiStatus: 0,
              apiMessage: 'ok',
              networkError: '-'
            }
          });
        } else {
          const apiStatus = res && res.data ? res.data.status : '-';
          const apiMessage = res && res.data ? (res.data.message || '') : '';
          resolve({
            name: buildCoordinateName(latitude, longitude),
            debug: {
              ok: false,
              reason: mapTencentErrorReason(apiStatus, apiMessage, res ? res.statusCode : 0),
              httpStatus: res ? res.statusCode : '-',
              apiStatus,
              apiMessage: apiMessage || '-',
              networkError: '-'
            }
          });
        }
      },
      fail(err) {
        reject(new Error((err && err.errMsg) || 'Geocoding request failed'));
      }
    });
  });
}

function reverseGeocodeByOpenWeather(latitude, longitude) {
  return new Promise((resolve) => {
    wx.request({
      url: 'https://api.openweathermap.org/geo/1.0/reverse',
      data: {
        lat: latitude,
        lon: longitude,
        limit: 1,
        appid: config.WEATHER_API_KEY
      },
      success(res) {
        if (res.statusCode === 200 && Array.isArray(res.data) && res.data.length > 0) {
          const item = res.data[0] || {};
          const zhName = item.local_names && (item.local_names.zh || item.local_names['zh-CN']);
          const cityName = zhName || item.name || '';
          const area = [item.state, item.country].filter(Boolean).join(' ');
          resolve({
            name: [cityName, area].filter(Boolean).join(' · ') || buildCoordinateName(latitude, longitude),
            debug: {
              ok: true,
              reason: 'OpenWeather 逆地理编码成功',
              httpStatus: res.statusCode,
              apiStatus: 200,
              apiMessage: 'ok',
              networkError: '-'
            }
          });
        } else {
          resolve({
            name: buildCoordinateName(latitude, longitude),
            debug: {
              ok: false,
              reason: 'OpenWeather 逆地理编码返回异常',
              httpStatus: res ? res.statusCode : '-',
              apiStatus: '-',
              apiMessage: (res && res.data && res.data.message) ? res.data.message : '-',
              networkError: '-'
            }
          });
        }
      },
      fail(err) {
        resolve({
          name: buildCoordinateName(latitude, longitude),
          debug: {
            ok: false,
            reason: 'OpenWeather 逆地理编码网络失败',
            httpStatus: '-',
            apiStatus: '-',
            apiMessage: '-',
            networkError: (err && err.errMsg) || 'request:fail'
          }
        });
      }
    });
  });
}

module.exports = {
  getCurrentLocation,
  __DEBUG_HAS_MAP_KEY__: !!config.TENCENT_MAP_KEY
};
