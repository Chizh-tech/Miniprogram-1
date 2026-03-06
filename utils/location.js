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

        if (!config.TENCENT_MAP_KEY) {
          // 未配置 API Key，只返回坐标
          resolve({
            latitude,
            longitude,
            name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
          });
          return;
        }

        // 使用腾讯地图反向地理编码获取地址
        reverseGeocode(latitude, longitude)
          .then(name => {
            resolve({ latitude, longitude, name });
          })
          .catch(() => {
            resolve({
              latitude,
              longitude,
              name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
            });
          });
      },
      fail(err) {
        reject(err);
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
          resolve(address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        } else {
          resolve(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
      },
      fail() {
        reject(new Error('Geocoding request failed'));
      }
    });
  });
}

module.exports = {
  getCurrentLocation
};
