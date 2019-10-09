import Input from 'postcss/lib/input';
import SafeParser from './safe-parser';

export default function safeParse(css: string, opts?: any) {
  let input = new Input(css, opts);

  let parser = new SafeParser(input);
  parser.parse();

  return parser.root;
}
