/**
 * TypeScript's bundled "DOM" lib (see client/tsconfig.json) does not
 * include the AudioWorkletGlobalScope typings — those normally come from
 * the separate `@types/audioworklet` package. Rather than add a dependency
 * for a handful of declarations, we declare just what
 * vadProcessor.worklet.ts needs. This file only affects type-checking; it
 * has no runtime behavior.
 */

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: AudioWorkletNodeOptions);
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processorCtor: {
    new (options?: AudioWorkletNodeOptions): AudioWorkletProcessor;
  }
): void;
