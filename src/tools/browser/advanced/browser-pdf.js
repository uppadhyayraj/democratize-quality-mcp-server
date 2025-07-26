const ToolBase = require('../../base/ToolBase');
const browserService = require('../../../services/browserService');
const fs = require('fs').promises;
const path = require('path');

/**
 * PDF Tool - Generate PDF files from web pages
 * Inspired by Playwright MCP PDF capabilities
 */
class BrowserPdfTool extends ToolBase {
    static definition = {
        name: "browser_pdf",
        description: "Generate PDF files from web pages with comprehensive formatting options and page control.",
        input_schema: {
            type: "object",
            properties: {
                browserId: { 
                    type: "string", 
                    description: "The ID of the browser instance" 
                },
                filePath: {
                    type: "string",
                    description: "Path where the PDF file will be saved"
                },
                options: {
                    type: "object",
                    properties: {
                        format: {
                            type: "string",
                            enum: ["A3", "A4", "A5", "Legal", "Letter", "Tabloid"],
                            default: "A4",
                            description: "Paper format"
                        },
                        width: {
                            type: "string",
                            description: "Paper width (e.g., '8.5in', '215.9mm')"
                        },
                        height: {
                            type: "string",
                            description: "Paper height (e.g., '11in', '279.4mm')"
                        },
                        landscape: {
                            type: "boolean",
                            default: false,
                            description: "Paper orientation"
                        },
                        margin: {
                            type: "object",
                            properties: {
                                top: { type: "string", description: "Top margin (e.g., '1in', '2.54cm')" },
                                bottom: { type: "string", description: "Bottom margin" },
                                left: { type: "string", description: "Left margin" },
                                right: { type: "string", description: "Right margin" }
                            },
                            description: "Page margins"
                        },
                        printBackground: {
                            type: "boolean",
                            default: true,
                            description: "Whether to print background graphics"
                        },
                        scale: {
                            type: "number",
                            minimum: 0.1,
                            maximum: 2,
                            default: 1,
                            description: "Scale factor for the PDF"
                        },
                        pageRanges: {
                            type: "string",
                            description: "Paper ranges to print (e.g., '1-5, 8, 11-13')"
                        },
                        headerTemplate: {
                            type: "string",
                            description: "HTML template for page header"
                        },
                        footerTemplate: {
                            type: "string",
                            description: "HTML template for page footer"
                        },
                        displayHeaderFooter: {
                            type: "boolean",
                            default: false,
                            description: "Whether to display header and footer"
                        },
                        preferCSSPageSize: {
                            type: "boolean",
                            default: false,
                            description: "Give preference to CSS page size"
                        }
                    },
                    description: "PDF generation options"
                },
                waitForSelector: {
                    type: "string",
                    description: "CSS selector to wait for before generating PDF"
                },
                waitForTimeout: {
                    type: "number",
                    default: 5000,
                    description: "Timeout for waiting in milliseconds"
                },
                generateBase64: {
                    type: "boolean",
                    default: false,
                    description: "Whether to return PDF as base64 string"
                }
            },
            required: ["browserId"]
        },
        output_schema: {
            type: "object",
            properties: {
                success: { type: "boolean", description: "Whether PDF generation was successful" },
                filePath: { type: "string", description: "Path where PDF was saved" },
                size: { type: "number", description: "PDF file size in bytes" },
                base64: { type: "string", description: "PDF content as base64 (if requested)" },
                pages: { type: "number", description: "Number of pages in PDF" },
                options: { type: "object", description: "PDF generation options used" },
                browserId: { type: "string", description: "Browser instance ID" }
            },
            required: ["success", "browserId"]
        }
    };

    async execute(parameters) {
        const { 
            browserId, 
            filePath, 
            options = {}, 
            waitForSelector, 
            waitForTimeout = 5000,
            generateBase64 = false
        } = parameters;
        
        const browser = browserService.getBrowserInstance(browserId);
        if (!browser) {
            throw new Error(`Browser instance '${browserId}' not found`);
        }

        const client = browser.client;
        
        // Enable Page domain
        await client.Page.enable();
        
        // Wait for specific element if requested
        if (waitForSelector) {
            await this.waitForSelector(client, waitForSelector, waitForTimeout);
        }
        
        // Prepare PDF options
        const pdfOptions = this.preparePdfOptions(options);
        
        // Generate filename if not provided
        const outputPath = filePath || this.generateDefaultPath();
        
        // Ensure output directory exists
        await this.ensureDirectoryExists(outputPath);
        
        try {
            // Generate PDF
            const pdfData = await client.Page.printToPDF(pdfOptions);
            
            // Save to file
            const buffer = Buffer.from(pdfData.data, 'base64');
            await fs.writeFile(outputPath, buffer);
            
            // Get file stats
            const stats = await fs.stat(outputPath);
            
            const result = {
                success: true,
                filePath: outputPath,
                size: stats.size,
                options: pdfOptions,
                browserId: browserId
            };
            
            // Add base64 if requested
            if (generateBase64) {
                result.base64 = pdfData.data;
            }
            
            // Estimate page count (rough calculation)
            result.pages = this.estimatePageCount(stats.size);
            
            return result;
        } catch (error) {
            throw new Error(`PDF generation failed: ${error.message}`);
        }
    }

    /**
     * Prepare PDF options for Chrome DevTools Protocol
     */
    preparePdfOptions(options) {
        const pdfOptions = {
            printBackground: options.printBackground !== undefined ? options.printBackground : true,
            landscape: options.landscape || false,
            scale: options.scale || 1,
            preferCSSPageSize: options.preferCSSPageSize || false,
            displayHeaderFooter: options.displayHeaderFooter || false
        };

        // Handle paper format or custom dimensions
        if (options.format) {
            pdfOptions.format = options.format;
        } else if (options.width || options.height) {
            if (options.width) pdfOptions.paperWidth = this.convertToInches(options.width);
            if (options.height) pdfOptions.paperHeight = this.convertToInches(options.height);
        }

        // Handle margins
        if (options.margin) {
            if (options.margin.top) pdfOptions.marginTop = this.convertToInches(options.margin.top);
            if (options.margin.bottom) pdfOptions.marginBottom = this.convertToInches(options.margin.bottom);
            if (options.margin.left) pdfOptions.marginLeft = this.convertToInches(options.margin.left);
            if (options.margin.right) pdfOptions.marginRight = this.convertToInches(options.margin.right);
        }

        // Handle page ranges
        if (options.pageRanges) {
            pdfOptions.pageRanges = options.pageRanges;
        }

        // Handle header/footer templates
        if (options.headerTemplate) {
            pdfOptions.headerTemplate = options.headerTemplate;
        }
        if (options.footerTemplate) {
            pdfOptions.footerTemplate = options.footerTemplate;
        }

        return pdfOptions;
    }

    /**
     * Convert various units to inches for CDP
     */
    convertToInches(value) {
        if (typeof value === 'number') return value;
        
        const numValue = parseFloat(value);
        const unit = value.replace(/[\d.-]/g, '').toLowerCase();
        
        switch (unit) {
            case 'in':
            case 'inch':
            case 'inches':
                return numValue;
            case 'cm':
                return numValue / 2.54;
            case 'mm':
                return numValue / 25.4;
            case 'pt':
                return numValue / 72;
            case 'px':
                return numValue / 96; // 96 DPI assumption
            default:
                return numValue; // Assume inches if no unit
        }
    }

    /**
     * Wait for a specific selector to appear
     */
    async waitForSelector(client, selector, timeout) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const result = await client.Runtime.evaluate({
                expression: `document.querySelector('${selector}') !== null`
            });
            
            if (result.result.value === true) {
                return;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        throw new Error(`Selector '${selector}' not found within ${timeout}ms`);
    }

    /**
     * Generate default PDF filename
     */
    generateDefaultPath() {
        const os = require('os');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        // Use output directory from environment or default to user home directory
        const defaultOutputDir = process.env.HOME 
            ? path.join(process.env.HOME, '.mcp-browser-control') 
            : path.join(os.tmpdir(), 'mcp-browser-control');
        const outputDir = process.env.OUTPUT_DIR || defaultOutputDir;
        
        return path.join(outputDir, `page-${timestamp}.pdf`);
    }

    /**
     * Ensure output directory exists
     */
    async ensureDirectoryExists(filePath) {
        const dir = path.dirname(filePath);
        try {
            await fs.access(dir);
        } catch {
            await fs.mkdir(dir, { recursive: true });
        }
    }

    /**
     * Estimate page count from file size (rough calculation)
     */
    estimatePageCount(fileSize) {
        // Very rough estimation: ~50KB per page average
        return Math.max(1, Math.round(fileSize / 50000));
    }

    /**
     * Create PDF with custom CSS for print
     */
    async createPdfWithPrintCSS(client, css, pdfOptions) {
        // Inject print-specific CSS
        await client.Runtime.evaluate({
            expression: `
                (function() {
                    const style = document.createElement('style');
                    style.textContent = \`@media print { ${css} }\`;
                    document.head.appendChild(style);
                })()
            `
        });

        // Generate PDF
        return await client.Page.printToPDF(pdfOptions);
    }

    /**
     * Get default header/footer templates
     */
    getDefaultTemplates() {
        return {
            header: `
                <div style="font-size: 10px; width: 100%; text-align: center; margin: 0;">
                    <span class="title"></span>
                </div>
            `,
            footer: `
                <div style="font-size: 10px; width: 100%; text-align: center; margin: 0;">
                    Page <span class="pageNumber"></span> of <span class="totalPages"></span>
                </div>
            `
        };
    }

    /**
     * Generate PDF with table of contents
     */
    async generatePdfWithTOC(client, pdfOptions) {
        // Extract headings for TOC
        const headings = await client.Runtime.evaluate({
            expression: `
                Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
                    level: parseInt(h.tagName.slice(1)),
                    text: h.textContent.trim(),
                    id: h.id || ''
                }))
            `
        });

        // Generate TOC HTML
        const tocHtml = this.generateTOCHtml(headings.result.value);

        // Insert TOC at beginning of document
        await client.Runtime.evaluate({
            expression: `
                (function() {
                    const toc = document.createElement('div');
                    toc.innerHTML = \`${tocHtml}\`;
                    toc.style.pageBreakAfter = 'always';
                    document.body.insertBefore(toc, document.body.firstChild);
                })()
            `
        });

        return await client.Page.printToPDF(pdfOptions);
    }

    /**
     * Generate Table of Contents HTML
     */
    generateTOCHtml(headings) {
        let tocHtml = '<div class="table-of-contents"><h2>Table of Contents</h2><ul>';
        
        headings.forEach((heading, index) => {
            const indent = '  '.repeat(heading.level - 1);
            tocHtml += `${indent}<li><a href="#${heading.id || `heading-${index}`}">${heading.text}</a></li>`;
        });
        
        tocHtml += '</ul></div>';
        return tocHtml;
    }
}

module.exports = BrowserPdfTool;
