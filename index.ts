import * as path from 'path';
import * as _ from 'lodash';
import * as xmlParser from 'xml-parser';
import * as SVGO from 'svgo';

export const cleanupOpts = {
  plugins: [
    {
      removeAttrs: {
        attrs: [
          'svg:xmlns'
        ]
      }
    },
    {
      removeDimensions: true
    },
    {
      removeTitle: true
    },
    {
      removeRasterImages: true
    }
  ]
};

function convertProps(attributes: xmlParser.Attributes): string {
  const props = _.mapKeys(attributes, (value: string, key: string) => _.camelCase(key));
  if (_.isEmpty(props)) {
    return 'null';
  }
  return JSON.stringify(props);
}

function visitNode(node: xmlParser.Node, isRoot: boolean): string {
  let props = convertProps(node.attributes);
  if (isRoot) {
    if (props === 'null') {
      props = 'props';
    } else {
      props = `assign({}, ${props}, props)`;
    }
  }
  let result = `createElement(${JSON.stringify(node.name)}, ${props}`;
  if (!_.isEmpty(node.children)) {
    const children = node.children.map(child => visitNode(child, false)).join(', ');
    result = [result, children].join(', ');
  }
  if (!_.isEmpty(node.content)) {
    result = [result, JSON.stringify(node.content)].join(', ');
  }
  result += ')';
  return result;
}

export default function transform(source: string): void {
  const callback = this.async();
  const svgo = new SVGO(cleanupOpts);
  svgo.optimize(source, result => {
    const tree: xmlParser.Document = xmlParser(result.data);
    const js = [
      'var createElement = require("react").createElement;',
      'var assign = require("object-assign");',
      'function reactIcon(props) {',
      `  return ${visitNode(tree.root, true)};`,
      '}',
      `reactIcon.displayName = ${JSON.stringify(path.basename(this.resourcePath))};`,
      'module.exports = reactIcon'
    ].join('\n');
    callback(null, js);
  });
}
