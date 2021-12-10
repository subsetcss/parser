import Input from 'postcss/lib/input';
import SafeParser from './safe-parser';

export default function createSafeParser(css: string, opts?: any) {
  const input = new Input(css, opts);

  const parser = new SafeParser(input);
  parser.parse();

  return parser.root;
}
