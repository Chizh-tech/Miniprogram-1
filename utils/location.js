/**
 * 位置服务
 * 获取用户当前位置和地址信息
 * 使用腾讯地图 API 进行反向地理编码
 * 需要在 config.js 中配置 TENCENT_MAP_KEY
 * 并在小程序后台添加合法域名：apis.map.qq.com
 */

const config = require('../config');

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

/**
 * 腾讯地图反向地理编码
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<string>} 地址名称
 */
function reverseGeocode(latitude, longitude) {
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
            name: address || city || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
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
            name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            debug: {
              ok: false,
              reason: '反向地理编码返回异常',
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

module.exports = {
  getCurrentLocation,
  __DEBUG_HAS_MAP_KEY__: !!config.TENCENT_MAP_KEY
};
