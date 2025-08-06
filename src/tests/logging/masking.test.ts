import { describe, it, expect } from 'vitest'
import { maskSensitiveData } from '../../file-logger.js'

describe('Sensitive Data Masking', () => {
  const sensitiveFields = ['password', 'refreshToken', 'encryptionKey', 'clientSecret'];

  it('should mask sensitive fields with partial display', () => {
    const data = {
      password: 'secret123456',
      refreshToken: '1//04abcdefghijklmnopqrstuvwxyz789',
      username: 'testuser'
    };
    
    const masked = maskSensitiveData(data, sensitiveFields);
    
    expect(masked.password).toBe('secr****3456');
    expect(masked.refreshToken).toBe('1//0**************************z789');
    expect(masked.username).toBe('testuser'); // 非機密は変更されない
  });

  it('should handle short sensitive values (8 characters or less)', () => {
    const data = { 
      password: 'short',
      encryptionKey: '12345678'
    };
    const masked = maskSensitiveData(data, sensitiveFields);
    expect(masked.password).toBe('*****');
    expect(masked.encryptionKey).toBe('********');
  });

  it('should handle empty sensitive values', () => {
    const data = { 
      password: '',
      refreshToken: 'normaltoken123456789'
    };
    const masked = maskSensitiveData(data, sensitiveFields);
    expect(masked.password).toBe('');
    expect(masked.refreshToken).toBe('norm************6789');
  });

  it('should handle non-object input', () => {
    expect(maskSensitiveData('string', sensitiveFields)).toBe('string');
    expect(maskSensitiveData(null, sensitiveFields)).toBe(null);
    expect(maskSensitiveData(123, sensitiveFields)).toBe(123);
    expect(maskSensitiveData(undefined, sensitiveFields)).toBe(undefined);
  });

  it('should handle arrays', () => {
    const data = [
      { password: 'secret123456' },
      { refreshToken: '1//04abcdefghijklmnopqrstuvwxyz789' }
    ];
    const masked = maskSensitiveData(data, sensitiveFields);
    
    expect(Array.isArray(masked)).toBe(true);
    expect(masked[0].password).toBe('secr****3456');
    expect(masked[1].refreshToken).toBe('1//0**************************z789');
  });

  it('should handle nested objects', () => {
    const data = {
      user: {
        password: 'secret123456',
        refreshToken: '1//04abcdefghijklmnopqrstuvwxyz789'
      },
      config: {
        encryptionKey: 'key123456789',
        publicData: 'not-sensitive'
      }
    };
    
    const masked = maskSensitiveData(data, sensitiveFields);
    
    expect(masked.user.password).toBe('secr****3456');
    expect(masked.user.refreshToken).toBe('1//0**************************z789');
    expect(masked.config.encryptionKey).toBe('key1****6789');
    expect(masked.config.publicData).toBe('not-sensitive');
  });

  it('should handle non-string sensitive field values', () => {
    const data = {
      password: 123, // 数値
      refreshToken: null, // null
      encryptionKey: undefined, // undefined
      clientSecret: 'real_secret123'
    };
    
    const masked = maskSensitiveData(data, sensitiveFields);
    
    expect(masked.password).toBe(123); // 文字列以外は変更されない
    expect(masked.refreshToken).toBe(null);
    expect(masked.encryptionKey).toBe(undefined);
    expect(masked.clientSecret).toBe('real******t123');
  });

  it('should use default sensitive fields when not provided', () => {
    const data = {
      password: 'secret123456',
      refreshToken: '1//04abcdefghijklmnopqrstuvwxyz789',
      encryptionKey: 'encryption123456',
      clientSecret: 'client_secret123456'
    };
    
    // デフォルトのsensitiveFieldsを使用（引数なし）
    const masked = maskSensitiveData(data);
    
    expect(masked.password).toBe('secr****3456');
    expect(masked.refreshToken).toBe('1//0**************************z789');
    expect(masked.encryptionKey).toBe('encr********3456');
    expect(masked.clientSecret).toBe('clie***********3456');
  });

  it('should handle exact 8 character values', () => {
    const data = {
      password: '12345678'
    };
    
    const masked = maskSensitiveData(data, sensitiveFields);
    expect(masked.password).toBe('********');
  });

  it('should handle 9 character values (minimum for partial display)', () => {
    const data = {
      password: '123456789'
    };
    
    const masked = maskSensitiveData(data, sensitiveFields);
    expect(masked.password).toBe('1234***6789');
  });
});