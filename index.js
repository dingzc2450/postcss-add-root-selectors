const postcss = require('postcss')

const globalRulesRe = /^((?:body|html)(?:[^\w ][^ ]+)?)( .*)?/
const inheritedDeclarationNamesRe = /^(-webkit-|-moz-|-moz-osx-|-o-|-ms-)?(?:color|font-.*|text-.*|line-height|letter-spacing|line-break|overflow-wrap|hyphens|tab-size|white-space|word-break|word-spacing|direction)$/

/**
 * @param opts {{
 *   rootSelectors: Array<string> | null,
 *   rootSelector: string | null 
 *   include: Array<string | RegExp>,
 *   exclude: Array<string | RegExp>,
 * }}
 */
const makeRuleProcessor = (opts = {}) => {
  if (!opts.rootSelectors || !Array.isArray(opts.rootSelectors)) {
    throw new Error('rootSelectors is not specified or it is not a Array')
  }

  const prependRoot = (rootSelector, selector) => {
    return `${rootSelector} ${selector}`
  }
  const insertRoot = (rootSelector, global, selector) => {
    return `${global} ${rootSelector}${selector || ''}`
  }

  const prependLocalSelector = (rootSelector, selector) => {
    if (selector === rootSelector) return selector
    if (selector === ':root') {
      return rootSelector
    }
    return prependRoot(rootSelector, selector)
  }

  const insertRootSelectorIntoGlobal = (rootSelector, selector) => {
    const m = selector.match(globalRulesRe)
    return insertRoot(rootSelector, m[1], m[2])
  }

  const updateNodeParent = parent => node => {
    node.parent = parent
    return node
  }

  const oneRule = (rootSelector, rule) => {
    if (rule.parent.type === 'atrule') {
      if (!['media', 'supports', 'document'].includes(rule.parent.name)) return
    }
    if (rule.selectors.some(selector => selector.startsWith('*'))) {
      rule.selectors = [rootSelector, ...rule.selectors]
    }

    const global = []
    const local = []
    rule.selectors.forEach(selector => {
      if (selector.match(globalRulesRe)) {
        global.push(selector)
      } else {
        local.push(selector)
      }
    })

    if (global.length === 0) {
      rule.selectors = rule.selectors.map((selector) => prependLocalSelector(rootSelector, selector))
      return
    }

    if (local.length > 0) {
      if (rule.every(decl => inheritedDeclarationNamesRe.test(decl.prop))) {
        rule.selectors = rule.selectors.map(selector => {
          return globalRulesRe.test(selector)
            ? insertRootSelectorIntoGlobal(rootSelector, selector)
            : prependLocalSelector(rootSelector, selector)
        })
        return
      }
      const localRule = rule.cloneBefore()
      localRule.selectors = local.map((v) => prependLocalSelector(rootSelector, v))
      rule.selectors = global
    }

    const inherited = []
    const selfApplied = []
    rule.each(decl => {
      if (inheritedDeclarationNamesRe.test(decl.prop)) {
        inherited.push(decl)
      } else {
        selfApplied.push(decl)
      }
    })

    if (selfApplied.length === 0) {
      rule.selectors = global.map((v) => insertRootSelectorIntoGlobal(rootSelector, v))
      return
    } else if (inherited.length === 0) {
      return
    }

    const inheritedRule = rule.cloneBefore()
    inheritedRule.selectors = global.map((v) => insertRootSelectorIntoGlobal(rootSelector, v))
    inheritedRule.nodes = inherited.map(updateNodeParent(inheritedRule))

    rule.nodes = selfApplied
  }
  return (rule) => {
    console.log("%c Line:104 🍕 rule", "color:#2eafb0", rule);
    opts.rootSelectors.forEach((rootSelector, index) => {
      const newRule = index === opts.rootSelectors.length - 1 ? rule : rule.cloneBefore()
      oneRule(rootSelector, newRule)
    })

  }
}

const includeFile = (root, opts) => {
  const fileName = root.source && root.source.input.file
  if (!fileName) return true

  if (opts.include && opts.include.length > 0) {
    return opts.include.some(pattern => fileName.match(pattern))
  }

  if (opts.exclude && opts.exclude.length > 0) {
    return !opts.exclude.some(pattern => fileName.match(pattern))
  }

  return true
}

const makeRootProcessor = (opts) => (root) => {
  if (includeFile(root, opts)) {
    opts.rootSelectors = opts.rootSelectors || (opts.rootSelector ? [opts.rootSelector] : null)
    root.walkRules(makeRuleProcessor(opts))
  }
}

const pluginName = 'postcss-add-root-selectors'

const versionFormat = (postcss) => {
  const isPostCSSv8 = postcss.Root !== undefined

  if (isPostCSSv8) {
    const plugin = (opts) => {
      return {
        postcssPlugin: pluginName,
        Once: makeRootProcessor(opts)
      }
    }
    plugin.postcss = true
    return plugin
  } else {
    return postcss.plugin(pluginName, (opts) => {
      return makeRootProcessor(opts)
    })
  }
}

module.exports = versionFormat(postcss)
module.exports.versionFormat = versionFormat
