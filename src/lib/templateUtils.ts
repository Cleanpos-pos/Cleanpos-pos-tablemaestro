/**
 * @fileOverview Utility for rendering simple string templates with placeholders.
 */

/**
 * Replaces placeholders in a string with values from a data object.
 * Placeholders are in the format {{key}}.
 * Supports simple conditional blocks like {{#if key}}...{{/if key}} or {{#if key}}...{{else}}...{{/if key}}.
 * Does not support nested conditionals or complex Handlebars features like #each.
 *
 * @param templateString The string containing placeholders.
 * @param data An object where keys correspond to placeholders.
 * @returns The rendered string.
 */
export function renderSimpleTemplate(templateString: string, data: Record<string, any>): string {
  let rendered = templateString;

  // Handle conditional blocks: {{#if key}}content{{/if}} or {{#if key}}content1{{else}}content2{{/if}}
  // Corrected regex to be more robust by removing the backreference which can be problematic.
  rendered = rendered.replace(
    /\{\{#if\s+([a-zA-Z0-9_]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\s*\}\}/g,
    (match, key, ifContent, elseContent) => {
      // Check for property existence and "truthiness" (not null, undefined, false, 0, or empty string)
      if (data[key] && String(data[key]).trim() !== '') {
        return ifContent;
      } else if (elseContent !== undefined) {
        return elseContent;
      }
      return '';
    }
  );

  // Handle simple placeholders: {{key}}
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      // Ensure data[key] is a string or number to avoid "undefined" or "[object Object]"
      const value = (typeof data[key] === 'string' || typeof data[key] === 'number') ? data[key] : '';
      rendered = rendered.replace(regex, String(value));
    }
  }
  return rendered;
}
