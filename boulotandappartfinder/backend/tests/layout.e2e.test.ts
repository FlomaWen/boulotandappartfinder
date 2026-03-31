import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function readTemplate(relativePath: string): string {
  return readFileSync(resolve(__dirname, '../../src/app/pages', relativePath), 'utf-8');
}

describe('JobSearch template - scraper panel layout', () => {
  const html = readTemplate('job-search/job-search.html');

  it('should have a .scrape-panel element', () => {
    expect(html).toContain('class="scrape-panel"');
  });

  it('should NOT have a .scrape-section inside the sidebar', () => {
    // Extract sidebar content (between <aside class="sidebar"> and </aside>)
    const sidebarMatch = html.match(/<aside class="sidebar">([\s\S]*?)<\/aside>/);
    expect(sidebarMatch).toBeTruthy();
    const sidebarContent = sidebarMatch![1];
    expect(sidebarContent).not.toContain('scrape-section');
  });

  it('sidebar should still contain filter sections', () => {
    const sidebarMatch = html.match(/<aside class="sidebar">([\s\S]*?)<\/aside>/);
    expect(sidebarMatch).toBeTruthy();
    expect(sidebarMatch![1]).toContain('filter-section');
  });

  it('scrape-panel should contain the scrape form', () => {
    // Extract scrape-panel content
    const panelMatch = html.match(/class="scrape-panel"([\s\S]*?)$/);
    expect(panelMatch).toBeTruthy();
    expect(panelMatch![1]).toContain('scrape-form');
  });
});

describe('ApartmentSearch template - scraper panel layout', () => {
  const html = readTemplate('apartment-search/apartment-search.html');

  it('should have a .scrape-panel element', () => {
    expect(html).toContain('class="scrape-panel"');
  });

  it('should NOT have a .scrape-section inside the sidebar', () => {
    const sidebarMatch = html.match(/<aside class="sidebar">([\s\S]*?)<\/aside>/);
    expect(sidebarMatch).toBeTruthy();
    const sidebarContent = sidebarMatch![1];
    expect(sidebarContent).not.toContain('scrape-section');
  });

  it('sidebar should still contain filter sections', () => {
    const sidebarMatch = html.match(/<aside class="sidebar">([\s\S]*?)<\/aside>/);
    expect(sidebarMatch).toBeTruthy();
    expect(sidebarMatch![1]).toContain('filter-section');
  });

  it('scrape-panel should contain the scrape form', () => {
    const panelMatch = html.match(/class="scrape-panel"([\s\S]*?)$/);
    expect(panelMatch).toBeTruthy();
    expect(panelMatch![1]).toContain('scrape-form');
  });
});
