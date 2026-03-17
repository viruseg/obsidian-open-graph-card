import { generateCardId } from '../../src/utils/id';

// Мокаем crypto для Node.js окружения
const mockRandomValues = jest.fn().mockImplementation((array: Uint8Array) => {
  for (let i = 0; i < array.length; i++) {
    array[i] = Math.floor(Math.random() * 256);
  }
  return array;
});

Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: mockRandomValues
  }
});

describe('generateCardId', () => {
  it('should return string with correct format', () => {
    const id = generateCardId();
    expect(id).toMatch(/^og_\d+_[a-z0-9]{8}$/);
  });

  it('should generate unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateCardId());
    }
    expect(ids.size).toBe(1000);
  });

  it('should start with og_ prefix', () => {
    const id = generateCardId();
    expect(id.startsWith('og_')).toBe(true);
  });

  it('should contain timestamp', () => {
    const beforeTime = Date.now();
    const id = generateCardId();
    const afterTime = Date.now();

    const parts = id.split('_');
    expect(parts.length).toBe(3);

    const timestamp = parseInt(parts[1]);
    expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
    expect(timestamp).toBeLessThanOrEqual(afterTime);
  });

  it('should have 8 character random suffix', () => {
    const id = generateCardId();
    const parts = id.split('_');
    expect(parts[2].length).toBe(8);
  });

  it('should use only lowercase letters and digits in random suffix', () => {
    const id = generateCardId();
    const parts = id.split('_');
    expect(parts[2]).toMatch(/^[a-z0-9]+$/);
  });

  it('should call crypto.getRandomValues', () => {
    mockRandomValues.mockClear();
    generateCardId();
    expect(mockRandomValues).toHaveBeenCalledTimes(1);
    expect(mockRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
  });
});
