/**
 * Sanitizes iframe video tags in HTML string to use youtube-nocookie, preserve aspect ratios,
 * and ensure responsive scaling on mobile viewports.
 * @param {string} s - HTML content
 * @returns {string}
 */
function toNoCookie(s) {
    if (!s || typeof s !== 'string') return '';
    return s
        .replace(/https?:\/\/(www\.)?youtube\.com\/embed\//g, 'https://www.youtube-nocookie.com/embed/')
        .replace(/<iframe([^>]*?)>/gi, (match, attrs) => {
            const isYT = /youtube(-nocookie)?\.com\/embed\//.test(match);
            if (!isYT) return match;

            let cleanAttrs = attrs.replace(/\s+sandbox="[^"]*"/gi, '');

            const wMatch = cleanAttrs.match(/\bwidth=["']?(\d+)/i);
            const hMatch = cleanAttrs.match(/\bheight=["']?(\d+)/i);
            const width = wMatch ? parseInt(wMatch[1], 10) : null;
            const height = hMatch ? parseInt(hMatch[1], 10) : null;

            const isVertical = Boolean(width && height && height > width);
            const aspectRatio = (width && height) ? `${width} / ${height}` : '16 / 9';

            if (!/\btitle=/i.test(cleanAttrs)) {
                cleanAttrs = ' title="YouTube video player"' + cleanAttrs;
            }
            if (!/\ballow=/i.test(cleanAttrs)) {
                cleanAttrs += ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"';
            }
            if (!/\ballowfullscreen\b/i.test(cleanAttrs)) {
                cleanAttrs += ' allowfullscreen';
            }
            if (!/\bloading=/i.test(cleanAttrs)) {
                cleanAttrs += ' loading="lazy"';
            }

            // Extract existing style
            const styleMatch = cleanAttrs.match(/\bstyle=["']([^"']*)["']/i);
            let styleContent = styleMatch ? styleMatch[1].trim() : '';
            if (styleContent && !styleContent.endsWith(';')) styleContent += ';';

            // Strip conflicting width/height/max-width/display/aspect-ratio/margin from existing inline style
            styleContent = styleContent
                .replace(/(?:^|;)\s*display:[^;]+;?/gi, ';')
                .replace(/(?:^|;)\s*margin-left:[^;]+;?/gi, ';')
                .replace(/(?:^|;)\s*margin-right:[^;]+;?/gi, ';')
                .replace(/(?:^|;)\s*max-width:[^;]+;?/gi, ';')
                .replace(/(?:^|;)\s*width:[^;]+;?/gi, ';')
                .replace(/(?:^|;)\s*height:[^;]+;?/gi, ';')
                .replace(/(?:^|;)\s*aspect-ratio:[^;]+;?/gi, ';')
                .replace(/;+/g, ';')
                .trim();
            if (styleContent.startsWith(';')) styleContent = styleContent.slice(1).trim();

            const maxWidthVal = isVertical ? `min(100%, ${width || 400}px)` : '100%';
            const responsiveStyles = `max-width: ${maxWidthVal}; width: 100%; height: auto; aspect-ratio: ${aspectRatio}; display: block; margin-left: auto; margin-right: auto;`;
            const finalStyle = styleContent ? `${styleContent} ${responsiveStyles}` : responsiveStyles;

            if (styleMatch) {
                cleanAttrs = cleanAttrs.replace(/\bstyle=["'][^"']*["']/i, `style="${finalStyle}"`);
            } else {
                cleanAttrs += ` style="${finalStyle}"`;
            }

            return `<iframe${cleanAttrs}>`;
        });
}

/**
 * Clean HTML for card previews and meta descriptions.
 */
function extractPreviewText(html) {
    if (!html || typeof html !== 'string') return '';

    let clean = html;

    // Strip multiple leading headers or leading bold elements at the start of content
    let prev = '';
    while (clean !== prev) {
        prev = clean;
        // Remove leading heading tags (h1-h6) at start
        clean = clean.replace(/^\s*<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '');
        // Remove leading <strong> or <b> tags (and optional trailing colon) at start, whether standalone or inside a leading <p>
        clean = clean.replace(/^\s*(?:<p[^>]*>\s*)?(?:<strong[^>]*>[\s\S]*?<\/strong>|<b[^>]*>[\s\S]*?<\/b>)\s*:?\s*/gi, '');
    }

    // Strip remaining HTML tags
    clean = clean.replace(/<[^>]*>/g, '');

    // Strip Markdown images, links, headings, emphasis, and code markers
    clean = clean
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/(?:^|\n)\s*#{1,6}\s+/g, ' ')
        .replace(/(\*\*\*|___|\*\*|__|~~|`)/g, '')
        .replace(/(?:^|[\s([{>"'])\*([^*\n]+)\*(?=$|[\s.,!?:;)\]}<"'])/g, ' $1')
        .replace(/(?:^|[\s([{>"'])_([^_\n]+)_(?=$|[\s.,!?:;)\]}<"'])/g, ' $1');

    // Replace HTML entities
    clean = clean
        .replace(/&nbsp;/gi, ' ')
        .replace(/&#160;/g, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/g, "'")
        .replace(/&[a-z0-9#]+;/gi, ' ');

    // Normalize whitespace
    return clean.replace(/\s+/g, ' ').trim();
}

/**
 * Escape raw text for safe HTML interpolation
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Resolve OpenBeta / relative markdown link URLs to canonical internal routes where possible
 * @param {string} rawHref
 * @returns {{ href: string, isExternal: boolean }}
 */
function resolveMarkdownHref(rawHref) {
    if (!rawHref || typeof rawHref !== 'string') {
        return { href: '#', isExternal: false };
    }
    const cleanHref = rawHref.trim().replace(/&amp;/g, '&');
    if (!cleanHref || /^(?:javascript|data|vbscript):/i.test(cleanHref)) {
        return { href: '#', isExternal: false };
    }

    const { getAreaByUuid, getClimbByUuid } = require(`${__hooks}/pages/utils/pocket.js`);

    // Match OpenBeta or relative area/crag links: ../<uuid>, /area/<uuid>, /crag/<uuid>, https://openbeta.io/crag/<uuid>, etc.
    const areaMatch = cleanHref.match(
        /^(?:https?:\/\/(?:www\.)?openbeta\.io)?(?:\/?(?:\.\.\/|\.\/)*(?:area|crag)s?\/|(?:\.\.\/|\.\/)+)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/[a-z0-9-]*)?\/?$/i
    );
    if (areaMatch) {
        const targetUuid = areaMatch[1];
        try {
            const areaRec = getAreaByUuid(targetUuid);
            if (areaRec) {
                return {
                    href: require(`${__hooks}/pages/utils/common.js`).buildAreaUrl(areaRec.id, areaRec.getString('name')),
                    isExternal: false
                };
            }
        } catch (_) {}
        return {
            href: `/area/${targetUuid}`,
            isExternal: false
        };
    }

    // Match OpenBeta or relative climb links: /climb/<uuid>, /climbs/<uuid>, https://openbeta.io/climbs/<uuid>, etc.
    const climbMatch = cleanHref.match(
        /^(?:https?:\/\/(?:www\.)?openbeta\.io)?(?:\/?(?:\.\.\/|\.\/)*climbs?\/)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/[a-z0-9-]*)?\/?$/i
    );
    if (climbMatch) {
        const climbUuid = climbMatch[1];
        try {
            const climbRec = getClimbByUuid(climbUuid);
            if (climbRec) {
                return {
                    href: require(`${__hooks}/pages/utils/common.js`).buildClimbUrl(climbRec.id, climbRec.getString('name')),
                    isExternal: false
                };
            }
        } catch (_) {}
        return {
            href: `/climb/${climbUuid}`,
            isExternal: false
        };
    }

    if (cleanHref.startsWith('/') || cleanHref.startsWith('#')) {
        return { href: cleanHref, isExternal: false };
    }

    if (/^(?:https?:\/\/|mailto:)/i.test(cleanHref)) {
        return { href: cleanHref, isExternal: true };
    }

    return { href: cleanHref, isExternal: true };
}

/**
 * Apply bold, italic, and strikethrough formatting to an already HTML-escaped string
 * @param {string} escapedStr
 * @returns {string}
 */
function formatInlineMarkdownText(escapedStr) {
    if (!escapedStr) return '';
    return escapedStr
        .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong class="font-semibold text-base-content"><em class="italic">$1</em></strong>')
        .replace(/___([^_]+)___/g, '<strong class="font-semibold text-base-content"><em class="italic">$1</em></strong>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-base-content">$1</strong>')
        .replace(/__([^_]+)__/g, '<strong class="font-semibold text-base-content">$1</strong>')
        .replace(/~~([^~]+)~~/g, '<del>$1</del>')
        .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em class="italic">$2</em>')
        .replace(/(^|[\s([{&]|&quot;|&#39;)_([^_\n]+)_(?=$|[\s.,!?:;)\]}&]|&quot;|&#39;)/g, '$1<em class="italic">$2</em>');
}

/**
 * Render inline Markdown (code spans, images, links, bare URLs, bold, italic, strikethrough) safely to HTML
 * @param {string} rawLine
 * @returns {string}
 */
function renderInlineMarkdown(rawLine) {
    if (!rawLine || typeof rawLine !== 'string') return '';

    const tokens = [];
    const stash = (html) => {
        const idx = tokens.length;
        tokens.push(html);
        return `\u0000MDTOK_${idx}_\u0000`;
    };

    let working = rawLine;

    // 1. Inline code spans: `code`
    working = working.replace(/`([^`\n]+)`/g, (_, code) =>
        stash(
            `<code class="px-1.5 py-0.5 rounded bg-base-100/80 border border-base-content/15 font-mono text-xs text-accent">${escapeHtml(code)}</code>`
        )
    );

    // 2. Markdown images: ![alt](url)
    working = working.replace(/!\[([^\]]*)\]\(((?:[^()\s]+|\([^()\s]*\))+)\)/g, (_, alt, rawUrl) => {
        const resolved = resolveMarkdownHref(rawUrl);
        return stash(
            `<img src="${escapeHtml(resolved.href)}" alt="${escapeHtml(alt)}" class="rounded-lg max-h-80 my-2 border border-base-content/10" loading="lazy" />`
        );
    });

    // 3. Markdown links: [label](url)
    working = working.replace(/\[([^\]]+)\]\(((?:[^()\s]+|\([^()\s]*\))+)\)/g, (_, label, rawUrl) => {
        const resolved = resolveMarkdownHref(rawUrl);
        const escapedLabel = formatInlineMarkdownText(escapeHtml(label));
        const targetAttrs = resolved.isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
        return stash(
            `<a href="${escapeHtml(resolved.href)}"${targetAttrs} class="text-accent hover:underline font-medium">${escapedLabel}</a>`
        );
    });

    // 4. Bare URLs: https://... or http://...
    working = working.replace(/https?:\/\/[^\s<>"')\]]+/gi, (matchedUrl) => {
        let cleanUrl = matchedUrl;
        let trailing = '';
        const trailMatch = cleanUrl.match(/([.,;:!?]+)$/);
        if (trailMatch) {
            trailing = trailMatch[1];
            cleanUrl = cleanUrl.slice(0, -trailing.length);
        }
        const resolved = resolveMarkdownHref(cleanUrl);
        const targetAttrs = resolved.isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
        return (
            stash(
                `<a href="${escapeHtml(resolved.href)}"${targetAttrs} class="text-accent hover:underline break-all">${escapeHtml(cleanUrl)}</a>`
            ) + trailing
        );
    });

    // 5. Escape remaining plain text and format bold/italic/strikethrough
    let formatted = formatInlineMarkdownText(escapeHtml(working));

    // 6. Restore stashed HTML tokens (including any nested inline code tokens inside link labels)
    let prev = '';
    while (formatted !== prev && formatted.includes('\u0000MDTOK_')) {
        prev = formatted;
        formatted = formatted.replace(/\u0000MDTOK_(\d+)_\u0000/g, (_, idx) => tokens[Number(idx)] || '');
    }

    return formatted;
}

/**
 * Render block and inline Markdown to safe, styled HTML for area/climb descriptions, locations, and beta
 * @param {string} markdownText
 * @param {{ inline?: boolean }} [options]
 * @returns {string}
 */
function renderMarkdown(markdownText, options = {}) {
    if (!markdownText || typeof markdownText !== 'string') return '';
    const normalized = markdownText.replace(/\r\n?/g, '\n').trim();
    if (!normalized) return '';

    if (options.inline && !normalized.includes('\n') && !/^\s*(?:#{1,6}\s+|[-*+]\s+|\d+\.\s+)/.test(normalized)) {
        return renderInlineMarkdown(normalized);
    }

    const lines = normalized.split('\n');
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip empty lines
        if (!trimmed) {
            i++;
            continue;
        }

        // Fenced code block: ```
        if (trimmed.startsWith('```')) {
            const codeLines = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            if (i < lines.length) i++;
            blocks.push(
                `<pre class="p-3 rounded-xl bg-base-100/80 border border-base-content/15 font-mono text-xs overflow-x-auto my-2"><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`
            );
            continue;
        }

        // Horizontal rule: ---, ***, ___
        if (/^(?:[-]{3,}|[*]{3,}|[_]{3,})$/.test(trimmed)) {
            blocks.push('<hr class="my-3 border-t border-base-content/20" />');
            i++;
            continue;
        }

        // ATX Headings: # through ###### (requires space after # so "#5 cam" is not treated as a heading)
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.+?)\s*#*$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const headingContent = renderInlineMarkdown(headingMatch[2]);
            const headingClasses = {
                1: 'text-lg font-bold text-secondary mt-4 mb-1.5 first:mt-0',
                2: 'text-base font-bold text-secondary mt-4 mb-1.5 first:mt-0',
                3: 'text-sm font-bold text-secondary mt-3.5 mb-1 first:mt-0',
                4: 'text-xs font-bold uppercase tracking-wider text-secondary mt-3.5 mb-1 first:mt-0',
                5: 'text-xs font-semibold uppercase tracking-wider text-secondary/90 mt-3 mb-1 first:mt-0',
                6: 'text-xs font-semibold text-base-content/80 mt-2.5 mb-1 first:mt-0'
            };
            const tag = `h${Math.min(Math.max(level, 2), 6)}`;
            blocks.push(`<${tag} class="${headingClasses[level] || headingClasses[4]}">${headingContent}</${tag}>`);
            i++;
            continue;
        }

        // Blockquote: > ...
        if (/^>\s?/.test(trimmed)) {
            const quoteLines = [];
            while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
                quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
                i++;
            }
            blocks.push(
                `<blockquote class="border-l-2 border-accent/60 pl-3 italic text-base-content/80 my-2">${quoteLines.map(renderInlineMarkdown).join('<br />')}</blockquote>`
            );
            continue;
        }

        // Unordered list: * item, - item, + item
        if (/^[-*+]\s+/.test(trimmed)) {
            const items = [];
            while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
                const itemText = lines[i].trim().replace(/^[-*+]\s+/, '');
                items.push(`<li>${renderInlineMarkdown(itemText)}</li>`);
                i++;
            }
            blocks.push(`<ul class="list-disc pl-5 space-y-1 my-2">${items.join('')}</ul>`);
            continue;
        }

        // Ordered list: 1. item, 2. item
        if (/^\d+\.\s+/.test(trimmed)) {
            const items = [];
            while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
                const itemText = lines[i].trim().replace(/^\d+\.\s+/, '');
                items.push(`<li>${renderInlineMarkdown(itemText)}</li>`);
                i++;
            }
            blocks.push(`<ol class="list-decimal pl-5 space-y-1 my-2">${items.join('')}</ol>`);
            continue;
        }

        // Standard paragraph: collect consecutive non-blank, non-block-starter lines
        const isBlockStarter = (trimmed) => (
            !trimmed ||
            trimmed.startsWith('```') ||
            /^#{1,6}\s+|^>\s?|^[-*+]\s+|^\d+\.\s+|^(?:[-]{3,}|[*]{3,}|[_]{3,})$/.test(trimmed)
        );

        const paraLines = [];
        while (i < lines.length && !isBlockStarter(lines[i].trim())) {
            paraLines.push(renderInlineMarkdown(lines[i].trim()));
            i++;
        }
        if (paraLines.length > 0) {
            blocks.push(`<p class="leading-relaxed">${paraLines.join('<br />')}</p>`);
        }
    }

    return blocks.join('\n');
}

module.exports = {
    toNoCookie,
    extractPreviewText,
    escapeHtml,
    resolveMarkdownHref,
    formatInlineMarkdownText,
    renderInlineMarkdown,
    renderMarkdown,
};
