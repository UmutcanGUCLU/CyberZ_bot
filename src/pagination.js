// Pagination helper — works with any array, encodes page in button IDs
const { ActionRowBuilder: AR, ButtonBuilder: BB, ButtonStyle: BS } = require("discord.js");

const DEFAULT_PER_PAGE = 10;

function paginate(items, page = 1, perPage = DEFAULT_PER_PAGE) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const p = Math.max(1, Math.min(Number(page) || 1, totalPages));
  const start = (p - 1) * perPage;
  return {
    items: items.slice(start, start + perPage),
    page: p,
    totalPages,
    total,
    hasPrev: p > 1,
    hasNext: p < totalPages,
  };
}

/**
 * Build prev/next buttons. customId format: `${basePrefix}_${pageNumber}`
 * Button handler should split on "_" and parse the trailing page.
 */
function pageRow(basePrefix, page, totalPages) {
  return new AR().addComponents(
    new BB().setCustomId(`${basePrefix}_${page - 1}`).setLabel("◀").setStyle(BS.Secondary).setDisabled(page <= 1),
    new BB().setCustomId(`${basePrefix}_info`).setLabel(`${page} / ${totalPages}`).setStyle(BS.Secondary).setDisabled(true),
    new BB().setCustomId(`${basePrefix}_${page + 1}`).setLabel("▶").setStyle(BS.Secondary).setDisabled(page >= totalPages),
  );
}

module.exports = { paginate, pageRow, DEFAULT_PER_PAGE };
