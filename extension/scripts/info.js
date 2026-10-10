export function run(){return[`Layar: ${screen.width}x${screen.height}`,`Bahasa: ${navigator.language}`,`Zona waktu: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`].join(`
`)}
