/**
 * Mulberry32 伪随机数生成器 (PRNG)
 * 提供 32-bit 状态的快速高质量伪随机数生成
 * 用于替代 Math.random() 以保证视觉实验的绝对确定性
 */
export class PRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /**
   * 生成 [0, 1) 之间的浮点数
   */
  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * 生成 [min, max) 之间的浮点数
   */
  public range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * 重置种子
   */
  public setSeed(seed: number): void {
    this.state = seed | 0;
  }
}

/**
 * 为了方便快速迁移原有代码，提供一个全局实例，但在规范的 Effect Core 中，
 * 应该实例化局部的 PRNG，并通过 setSeed 保证每次初始化的完全一致性。
 */
export const globalPRNG = new PRNG(1337);
