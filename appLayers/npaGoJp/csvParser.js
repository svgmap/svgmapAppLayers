// エスケープされたCSVの読み込み関数

// http://var.blog.jp/archives/84996787.html
// このロジックは先頭に空カラムがあると消える

// https://zenn.dev/itte/articles/516228940932a5
// 改行だけの行も1カラムデータとされる
const parseCsv = csv => csv.replace(/\r/g, '').split('\n').reduce(([data, isInQuotes], line) => {
  const [datum, newIsInQuotes] = ((isInQuotes ? '"' : '') + line).split(',').reduce(([datum, isInQuotes], text) => {
    const match = isInQuotes || text.match(/^(\"?)((.*?)(\"*))$/)
    if (isInQuotes) datum[datum.length - 1] += ',' + text.replace(/\"+/g, m => '"'.repeat(m.length / 2))
    else datum.push(match[1] ? match[2].replace(/\"+/g, m => '"'.repeat(m.length / 2)) : match[2])
    return [datum, isInQuotes ? !(text.match(/\"*$/)[0].length % 2) : match[1] && !(match[4].length % 2)]
  }, [[]])
  if (isInQuotes) data[data.length - 1].push(data[data.length - 1].pop() + '\n' + datum[0], ...datum.slice(1))
  else data.push(datum)
  return [data, newIsInQuotes]
}, [[]])[0]
export { parseCsv }