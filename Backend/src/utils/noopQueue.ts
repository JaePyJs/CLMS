export class NoopQueue {
  private _paused = false;

  async add(name: string, data?: any, opts?: any): Promise<{ id: string; name?: string; data?: any; opts?: any }> {
    return { id: `noop_${Date.now()}_${Math.random().toString(36).slice(2)}`, name, data, opts };
  }

  async addBulk(jobs: Array<{ name: string; data: any; options?: any }>): Promise<Array<{ id: string; name?: string; data?: any; options?: any }>> {
    const now = Date.now();
    return jobs.map(j => ({ id: `noop_${now}_${Math.random().toString(36).slice(2)}`, name: j.name, data: j.data, options: j.options }));
  }

  // Accept any signature variants; do nothing
  process(..._args: any[]): void {}

  on(_event: string, _handler: (...args: any[]) => any): void {}

  async pause(): Promise<void> { this._paused = true; }

  async resume(): Promise<void> { this._paused = false; }

  async isPaused(): Promise<boolean> { return this._paused; }

  async close(): Promise<void> {}

  async clean(_cutoff: number, _status: string): Promise<void> {}

  // Common Bull APIs for stats
  async getWaiting(): Promise<any[]> { return []; }
  async getActive(): Promise<any[]> { return []; }
  async getCompleted(): Promise<any[]> { return []; }
  async getFailed(): Promise<any[]> { return []; }
  async getDelayed(): Promise<any[]> { return []; }

  // BullMQ-like APIs
  async count(): Promise<number> { return 0; }
  async getJobCounts(): Promise<{ waiting: number; active: number; completed: number; failed: number; delayed?: number; paused?: boolean }> {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: this._paused } as any;
  }
}

export class NoopWorker {
  constructor(_queueName?: string, _processor?: any, _opts?: any) {}
  on(_event: string, _handler: (...args: any[]) => any): void {}
  async close(): Promise<void> {}
}

export default NoopQueue;