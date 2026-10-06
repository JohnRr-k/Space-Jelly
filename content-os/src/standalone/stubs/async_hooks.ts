/** Browser stand-in for node:async_hooks. The single-file app has one user, so a simple stack suffices. */
export class AsyncLocalStorage<T> {
  private stack: T[] = [];
  run<R>(store: T, fn: () => R): R {
    this.stack.push(store);
    try {
      const r = fn();
      if (r instanceof Promise) return r.finally(() => this.stack.pop()) as R;
      this.stack.pop();
      return r;
    } catch (e) {
      this.stack.pop();
      throw e;
    }
  }
  getStore(): T | undefined {
    return this.stack[this.stack.length - 1];
  }
}
