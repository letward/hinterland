const defaultSurfaces = {
  dark: ['#17131f', '#211a2c', '#fff1e8'],
  light: ['#f8f2ed', '#fffaf6', '#2b2035'],
};

export function applySurfaceColors(root, theme, get) {
  const defaults = defaultSurfaces[theme];
  const keys = ['Background', 'Surface', 'Text'];
  const properties = ['--bg', '--surface', '--text'];
  const values = keys.map((key, index) => {
    const value = get(`appearance.${theme}${key}`, defaults[index]);
    return typeof value === 'string' && /^#[\da-f]{3,8}$/i.test(value) ? value.toLowerCase() : defaults[index];
  });
  const usesDefault = values.every((value, index) => value === defaults[index]);
  for (const [index, property] of properties.entries()) {
    if (usesDefault) root.style.removeProperty(property);
    else root.style.setProperty(property, values[index]);
  }
}
