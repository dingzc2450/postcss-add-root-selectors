
const postcss = require('postcss')

const plugin = require('./');

async function run(input, output, opts = {}, from) {
    const result = await postcss([plugin(opts)]).process(input, { from })
    console.log("%c Line:8 🍖 result", "color:#465975", result.css);
    //   expect(result.css).toEqual(output)
    //   expect(result.warnings()).toHaveLength(0)
}

run('a{color: red}', '.some-root a{color: red}', { rootSelectors: ['.some-root', '.other-root'] })