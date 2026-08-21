'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');

describe('alipay', () => {
  const alipay = require('../utils/alipay.cjs');

  describe('isAlipayConfigured', () => {
    test('环境变量齐全返回 true', () => {
      const orig = { ...process.env };
      process.env.ALIPAY_APP_ID = 'test_id';
      process.env.ALIPAY_PRIVATE_KEY = 'test_key';
      process.env.ALIPAY_PUBLIC_KEY = 'test_pub';
      assert.strictEqual(alipay.isAlipayConfigured(), true);
      process.env = orig;
    });

    test('缺少环境变量返回 false', () => {
      const orig = { ...process.env };
      delete process.env.ALIPAY_APP_ID;
      assert.strictEqual(alipay.isAlipayConfigured(), false);
      process.env = orig;
    });

    test('部分缺少返回 false', () => {
      const orig = { ...process.env };
      process.env.ALIPAY_APP_ID = 'test_id';
      delete process.env.ALIPAY_PRIVATE_KEY;
      assert.strictEqual(alipay.isAlipayConfigured(), false);
      process.env = orig;
    });
  });

  describe('getAlipaySdk', () => {
    test('未配置时返回 null', () => {
      const orig = { ...process.env };
      delete process.env.ALIPAY_APP_ID;
      delete process.env.ALIPAY_PRIVATE_KEY;
      delete process.env.ALIPAY_PUBLIC_KEY;
      assert.strictEqual(alipay.getAlipaySdk(), null);
      process.env = orig;
    });
  });

  describe('getOAuthToken', () => {
    test('SDK未配置时抛出错误', async () => {
      const orig = { ...process.env };
      delete process.env.ALIPAY_APP_ID;
      delete process.env.ALIPAY_PRIVATE_KEY;
      delete process.env.ALIPAY_PUBLIC_KEY;
      await assert.rejects(
        alipay.getOAuthToken('test_code'),
        { message: '支付宝SDK未配置' }
      );
      process.env = orig;
    });
  });

  describe('getUserInfo', () => {
    test('SDK未配置时抛出错误', async () => {
      const orig = { ...process.env };
      delete process.env.ALIPAY_APP_ID;
      delete process.env.ALIPAY_PRIVATE_KEY;
      delete process.env.ALIPAY_PUBLIC_KEY;
      await assert.rejects(
        alipay.getUserInfo('test_token'),
        { message: '支付宝SDK未配置' }
      );
      process.env = orig;
    });
  });

  describe('createPayment', () => {
    test('SDK未配置时抛出错误', async () => {
      const orig = { ...process.env };
      delete process.env.ALIPAY_APP_ID;
      delete process.env.ALIPAY_PRIVATE_KEY;
      delete process.env.ALIPAY_PUBLIC_KEY;
      await assert.rejects(
        alipay.createPayment('no123', 9.9, '测试商品'),
        { message: '支付宝SDK未配置' }
      );
      process.env = orig;
    });
  });

  describe('queryPayment', () => {
    test('SDK未配置时抛出错误', async () => {
      const orig = { ...process.env };
      delete process.env.ALIPAY_APP_ID;
      delete process.env.ALIPAY_PRIVATE_KEY;
      delete process.env.ALIPAY_PUBLIC_KEY;
      await assert.rejects(
        alipay.queryPayment('no123'),
        { message: '支付宝SDK未配置' }
      );
      process.env = orig;
    });
  });

  describe('verifyNotification', () => {
    test('SDK未配置时返回 false', () => {
      const orig = { ...process.env };
      delete process.env.ALIPAY_APP_ID;
      delete process.env.ALIPAY_PRIVATE_KEY;
      delete process.env.ALIPAY_PUBLIC_KEY;
      assert.strictEqual(alipay.verifyNotification({}), false);
      process.env = orig;
    });
  });
});
