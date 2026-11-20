import type { Buffer } from 'node:buffer';

export type TypeGuess = { type: string; confidence: number };

export interface Classifier {
  /** Ranked guesses, best first. `hint` is an optional worker-chosen type. */
  classify(image: Buffer, hint?: string): Promise<TypeGuess[]>;
}
export interface Ocr {
  read(image: Buffer): Promise<string>;
}

/** STUB: not a real vision model. Uses the worker's hint, otherwise says 'unknown'. Always low confidence. */
export class StubClassifier implements Classifier {
  readonly isStub = true;
  async classify(_image: Buffer, hint?: string): Promise<TypeGuess[]> {
    return [{ type: hint ?? 'unknown', confidence: 0.5 }];
  }
}

/** Real OCR using tesseract.js. The worker is created lazily and reused. */
export class TesseractOcr implements Ocr {
  private worker: any;
  async read(image: Buffer): Promise<string> {
    if (!this.worker) {
      const { createWorker } = await import('tesseract.js');
      this.worker = await createWorker('eng');
    }
    const { data } = await this.worker.recognize(image);
    return data.text as string;
  }
  async close() { await this.worker?.terminate(); }
}