import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import safeParser from './safe-parse';

const shorthandMap: ShorthandMap = {
  border: ['border-width', 'border-style', 'border-color'],
  margin: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
  padding: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  background: [],
};
const shorthandKeys = Object.keys(shorthandMap);
const findShorthand = (prop: string) => {
  return shorthandKeys.find(key => {
    let longHands = shorthandMap[key];
    return longHands && longHands.includes(prop);
  });
};

export async function parser(
  subsetConfig: SubsetConfig,
  css: string,
  lineNumber: number
): Promise<ParserResult> {
  let parsed: postcss.Root = safeParser(css);

  let result: ParserResult = await new Promise(resolve => {
    let found = false;

    parsed.walkRules((node: postcss.Rule) => {
      if (!node.source) {
        return;
      }

      let startLine = node.source.start && node.source.start.line;
      let endLine = node.source.end && node.source.end.line;

      if (!startLine || !endLine) {
        return;
      }

      if (lineNumber >= startLine && lineNumber <= endLine) {
        node.walkDecls((decl: postcss.Declaration) => {
          if (
            !decl.source ||
            !decl.source.start ||
            decl.source.start.line !== lineNumber + 1
          ) {
            return;
          }

          let rootConfig = getSubsetConfig(subsetConfig, decl);
          let config = rootConfig ? rootConfig.subsets[decl.prop] : [];

          if (!config || !config.length) {
            config = config || [];
            let alternates = shorthandMap[decl.prop];

            if (alternates) {
              alternates.forEach(alt => {
                let altConfig = rootConfig
                  ? rootConfig.subsets[alt]
                  : undefined;

                if (altConfig) {
                  config = [
                    ...mapSubset(config, decl.prop, decl.value),
                    ...mapSubset(altConfig, decl.prop, decl.value),
                  ];
                }
              });
            } else {
              let shorthand = findShorthand(decl.prop);
              let shorthandConfig =
                rootConfig && shorthand
                  ? rootConfig.subsets[shorthand]
                  : undefined;

              if (shorthandConfig) {
                config = [
                  ...mapSubset(config, decl.prop, decl.value),
                  ...mapSubset(shorthandConfig, decl.prop, decl.value),
                ];
              }
            }
          }

          if (config) {
            found = true;
            resolve({
              config,
              decl,
            });
          }
        });
      }
    });

    if (!found) {
      resolve({
        config: [],
      });
    }
  });

  return result;
}

export function getSubsetConfig(
  subsetConfig: SubsetConfig,
  decl: postcss.Declaration
) {
  let grandParent = decl.parent.parent;
  if (!grandParent || grandParent.type !== 'atrule') {
    return subsetConfig;
  }
  let inAtRule = grandParent && grandParent.type === 'atrule';

  let rootConfig =
    grandParent && inAtRule
      ? subsetConfig[`@${grandParent.name}`]
      : subsetConfig;

  if (!Array.isArray(rootConfig)) {
    return subsetConfig;
  }

  let { nodes } = valueParser(grandParent.params);

  if (nodes.length) {
    let typeNode = nodes.find((node: ValueParserNode) => node.type === 'word');
    let type = typeNode && typeNode.value;
    let filteredConfigs: AtMediaConfig[] = rootConfig;

    if (type) {
      filteredConfigs = rootConfig.filter(
        conf => conf.type && conf.type === type
      );
    }

    let words: string[] = [];
    let func = nodes.find((node: ValueParserNode) => node.type === 'function');

    if (!func) {
      return filteredConfigs.length ? filteredConfigs[0] : subsetConfig;
    }

    func.nodes.forEach((node: ValueParserNode) => {
      if (node.type === 'word') {
        words.push(node.value);
      }
    });

    if (words.length === 2) {
      let [prop, value] = words;
      let config = filteredConfigs.find(conf => {
        let param = conf.params && conf.params[prop];
        return param && param.includes(value);
      });

      return config || subsetConfig;
    }

    return filteredConfigs.length ? filteredConfigs[0] : subsetConfig;
  }

  return subsetConfig;
}

export function mapSubset(subset: SubsetValue, prop: string, value: string) {
  return typeof subset === 'function' ? subset(prop, value) : subset;
}

export interface ParserResult {
  config: SubsetValue;
  decl?: postcss.Declaration;
}

export interface SubsetConfig {
  subsets: Subsets;
  ['@media']?: AtMediaConfig[];
  [key: string]: any;
}

export type SubsetFunc = (key: string, val: string | null) => string[];

export type SubsetValue = string[] | SubsetFunc;

export interface Subsets {
  [key: string]: SubsetValue;
}

export interface AtMediaConfig {
  type?: string;
  params?: {
    [key: string]: string[];
  };
  subsets: Subsets;
}

interface ValueParserNode {
  type: string;
  value: string;
}

interface ShorthandMap {
  [type: string]: string[];
}
