import type * as postcss from 'postcss';
import * as valueParser from 'postcss-value-parser';
import createSafeParser from './safe-parse';

const shorthandMap: ShorthandMap = {
  border: ['border-width', 'border-style', 'border-color'],
  margin: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
  padding: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  background: [],
};
const shorthandKeys = Object.keys(shorthandMap);
const findShorthand = (prop: string) => {
  return shorthandKeys.find(key => {
    const longHands = shorthandMap[key];
    return longHands && longHands.includes(prop);
  });
};

export async function parser(
  subsetConfig: SubsetConfig,
  css: string,
  lineNumber: number
): Promise<ParserResult> {
  const parsed: postcss.Root = createSafeParser(css);

  const result: ParserResult = await new Promise(resolve => {
    let found = false;

    parsed.walkRules((node: postcss.Rule) => {
      if (!node.source) {
        return;
      }

      const startLine = node.source.start && node.source.start.line;
      const endLine = node.source.end && node.source.end.line;

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

          const rootConfig = getSubsetConfig(subsetConfig, decl);
          let config = rootConfig ? rootConfig.subsets[decl.prop] : [];

          if (!config || !config.length) {
            config = config || [];
            const alternates = shorthandMap[decl.prop];

            if (alternates) {
              alternates.forEach(alt => {
                const altConfig = rootConfig
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
              const shorthand = findShorthand(decl.prop);
              const shorthandConfig =
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
  const grandParent = decl.parent && decl.parent.parent;
  if (!grandParent || grandParent.type !== 'atrule') {
    return subsetConfig;
  }
  let rootConfig = subsetConfig;

  if (grandParent && isAtRule(grandParent)) {
    rootConfig = subsetConfig[`@${grandParent.name}`];
  }

  if (!Array.isArray(rootConfig)) {
    return subsetConfig;
  }

  if (!isAtRule(grandParent)) {
    throw new Error('Invalid');
  }

  const { nodes } = valueParser(grandParent.params);

  if (nodes.length) {
    const typeNode = nodes.find(
      (node: ValueParserNode) => node.type === 'word'
    );
    const type = typeNode && typeNode.value;
    let filteredConfigs: AtMediaConfig[] = rootConfig;

    if (type) {
      filteredConfigs = rootConfig.filter(
        conf => conf.type && conf.type === type
      );
    }

    const words: string[] = [];
    const func = nodes.find(
      (node: ValueParserNode) => node.type === 'function'
    );

    if (!func) {
      return filteredConfigs.length ? filteredConfigs[0] : subsetConfig;
    }

    func.nodes.forEach((node: ValueParserNode) => {
      if (node.type === 'word') {
        words.push(node.value);
      }
    });

    if (words.length === 2) {
      const [prop, value] = words;
      const config = filteredConfigs.find(conf => {
        const param = conf.params && conf.params[prop];
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

function isAtRule(rule: any): rule is postcss.AtRule {
  return rule && rule.type === 'atrule';
}
