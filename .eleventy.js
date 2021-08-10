module.exports = eleventyConfig => {
  const markdownIt = require('markdown-it');
  const markdownItAnchor = require('markdown-it-anchor');

  const markdownLib = markdownIt().use(markdownItAnchor);

  eleventyConfig.setLibrary("md", markdownLib);

  return {
    dir: {
      input: "documentation",
      output: "app/documentation"
    }
  };
};
