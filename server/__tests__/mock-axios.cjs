'use strict';

// 可配置的 axios mock：测试通过 __setResponse / __setError 控制返回值
let _response = null;
let _error = null;
const _calls = [];

async function get(url, config) {
  _calls.push({ url, config });
  if (_error) throw _error;
  if (typeof _response === 'function') return _response(url, config);
  return _response;
}

module.exports = {
  get,
  __setResponse: (r) => { _response = r; _error = null; },
  __setError: (e) => { _error = e; _response = null; },
  __reset: () => { _response = null; _error = null; _calls.length = 0; },
  __getCalls: () => _calls,
};
