/**
 * @module @enojaroff/xt-listshowlist
 *
 * Enhanced ListShowList viewtemplate plugin for Saltcorn.
 *
 * Provides a two-panel layout (list + detail) with advanced features:
 * - Resizable split pane with drag handle (mouse & touch)
 * - Horizontal or vertical orientation
 * - Per-panel background color and directional padding
 * - Subtable display modes: tabs, pills, accordion, or stacked list
 * - Cookie-based persistence of split position
 * - Auto-fit height in vertical split mode
 *
 * Configuration is a two-step workflow:
 *   Step 1 — Views & Layout: select list/show views, orientation, split pane, styling
 *   Step 2 — Subtables: pick related child/parent views to display below the detail
 */

const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const View = require("@saltcorn/data/models/view");
const Workflow = require("@saltcorn/data/models/workflow");
const { text, div, h1, h2, h3, h4, h5, h6, a, ul, li, button } = require("@saltcorn/markup/tags");
const { renderForm, tabs } = require("@saltcorn/markup");
const {
  get_child_views,
  get_parent_views,
  readState,
} = require("@saltcorn/data/plugin-helper");
const { splitUniques } = require("@saltcorn/data/base-plugin/viewtemplates/viewable_fields");
const { InvalidConfiguration, extractPagings } = require("@saltcorn/data/utils");

// ─────────────────────────────────────────────────────────────
// Subtable field name encoding
// ─────────────────────────────────────────────────────────────

/**
 * Encode a subtable spec string so it is safe for use as a form field name.
 *
 * Saltcorn's `showIf` mechanism generates jQuery selectors like
 * `[data-fieldname=NAME]`. Characters such as `:`, `.`, and spaces break
 * these selectors silently. This function replaces every non-alphanumeric
 * (except `_`) character with `_0x<hex charcode>_`.
 *
 * @param {string} s - The original spec string (e.g. "ChildList:view.table.field")
 * @returns {string} Encoded string safe for CSS selectors and form field names
 */
const encodeSubKey = (s) =>
  s.replace(/[^a-zA-Z0-9_]/g, (c) => `_0x${c.charCodeAt(0).toString(16)}_`);

/**
 * Decode a previously encoded subtable spec string back to its original form.
 *
 * @param {string} s - The encoded string
 * @returns {string} Original spec string
 */
const decodeSubKey = (s) =>
  s.replace(/_0x([0-9a-f]+)_/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

// ─────────────────────────────────────────────────────────────
// Configuration Workflow
// ─────────────────────────────────────────────────────────────

/**
 * Build the two-step configuration workflow for ListShowListEnhanced.
 *
 * @param {object} req - Express request object (provides `req.__()` for i18n)
 * @returns {Workflow} Saltcorn Workflow instance
 */
const configuration_workflow = (req) =>
  new Workflow({
    steps: [
      // ── Step 1: Views & Layout ──
      {
        name: req.__("Views"),
        form: async (context) => {
          // Find list-type views (view_quantity === "Many") for this table
          const list_views = await View.find_table_views_where(
            context.table_id,
            ({ state_fields, viewrow, viewtemplate }) =>
              viewtemplate.view_quantity === "Many" &&
              viewrow.name !== context.viewname &&
              state_fields.every((sf) => !sf.required)
          );
          const list_view_opts = list_views.map((v) => v.name);

          // Find show-type views (must accept an "id" state field) for this table
          const show_views = await View.find_table_views_where(
            context.table_id,
            ({ state_fields, viewrow }) =>
              viewrow.name !== context.viewname &&
              state_fields.some((sf) => sf.name === "id")
          );
          const show_view_opts = show_views.map((v) => v.name);

          return new Form({
            fields: [
              {
                name: "list_view",
                label: req.__("List View"),
                type: "String",
                sublabel:
                  req.__("A list view shown on the left, to select rows") +
                  ". " +
                  a(
                    {
                      "data-dyn-href": `\`/viewedit/config/\${list_view}\``,
                      target: "_blank",
                    },
                    req.__("Configure")
                  ),
                required: false,
                attributes: { options: list_view_opts },
              },
              {
                name: "show_view",
                label: req.__("Show View"),
                type: "String",
                sublabel:
                  req.__("The view to show the selected row") +
                  ". " +
                  a(
                    {
                      "data-dyn-href": `\`/viewedit/config/\${show_view}\``,
                      target: "_blank",
                    },
                    req.__("Configure")
                  ),
                required: false,
                attributes: { options: show_view_opts },
              },
              {
                name: "list_width",
                label: req.__("List width"),
                sublabel: req.__(
                  "Number of columns (1-12) allocated to the list view (grid mode only)"
                ),
                type: "Integer",
                default: 6,
                attributes: { min: 1, max: 12 },
              },
              {
                name: "orientation",
                label: req.__("Orientation"),
                sublabel: req.__("Arrangement of the list and detail panels"),
                type: "String",
                required: true,
                default: "horizontal",
                attributes: {
                  options: ["horizontal", "vertical"],
                },
              },
              {
                name: "responsive",
                label: req.__("Responsive"),
                sublabel: req.__(
                  "Automatically switch to vertical layout on screens narrower than 768px"
                ),
                type: "Bool",
                default: false,
              },
              {
                name: "show_on_select",
                label: req.__("Show on select"),
                sublabel: req.__(
                  "If enabled, the detail view updates when a row is clicked in the list"
                ),
                type: "Bool",
                default: true,
              },
              {
                name: "split_view",
                label: req.__("Split view"),
                sublabel: req.__(
                  "Enable a resizable split pane with a drag handle instead of Bootstrap grid"
                ),
                type: "Bool",
                default: false,
              },
              {
                name: "split_height",
                label: req.__("Split height"),
                sublabel: req.__(
                  "CSS height of the split container in vertical mode (e.g. 600px, 80vh). Defaults to 100vh"
                ),
                type: "String",
                showIf: { split_view: true, orientation: "vertical" },
              },
              {
                name: "use_handle_color",
                label: req.__("Split handle color"),
                sublabel: req.__("Override the default grey color of the resize handle"),
                type: "Bool",
                default: false,
                showIf: { split_view: true },
              },
              {
                name: "handle_color",
                label: req.__("Color"),
                type: "Color",
                showIf: { split_view: true, use_handle_color: true },
              },
              {
                name: "use_list_bg_color",
                label: req.__("List background color"),
                type: "Bool",
                default: false,
              },
              {
                name: "list_bg_color",
                label: req.__("Color"),
                type: "Color",
                showIf: { use_list_bg_color: true },
              },
              {
                name: "list_h_padding",
                label: req.__("List hor. padding (px)"),
                sublabel: req.__("Left/right padding in horizontal mode, top/bottom in vertical mode"),
                type: "Integer",
                default: 0,
                attributes: { min: 0 },
              },
              {
                name: "list_v_padding",
                label: req.__("List vert. padding (px)"),
                sublabel: req.__("Left/right padding in horizontal mode, top/bottom in vertical mode"),
                type: "Integer",
                default: 0,
                attributes: { min: 0 },
              },
              {
                name: "use_show_bg_color",
                label: req.__("Detail background color"),
                type: "Bool",
                default: false,
              },
              {
                name: "show_bg_color",
                label: req.__("Color"),
                type: "Color",
                showIf: { use_show_bg_color: true },
              },
              {
                name: "show_h_padding",
                label: req.__("Detail hor. padding (px)"),
                sublabel: req.__("Left/right padding"),
                type: "Integer",
                default: 0,
                attributes: { min: 0 },
              },
              {
                name: "show_v_padding",
                label: req.__("Detail vert. padding (px)"),
                sublabel: req.__("Top/bottom padding"),
                type: "Integer",
                default: 0,
                attributes: { min: 0 },
              },
            ],
          });
        },
      },

      // ── Step 2: Subtables ──
      // contextField stores these values inside configuration.subtables
      {
        name: req.__("Subtables"),
        contextField: "subtables",
        form: async (context) => {
          const tbl = Table.findOne({ id: context.table_id });
          var fields = [];

          // Child views (one-to-many relationships)
          const child_views = await get_child_views(tbl, context.viewname);
          for (const { relation, related_table, views } of child_views) {

            // Add a section pour every table
            fields.push({
              label: req.__("Views for table") + `: <b>${related_table.name}</b>&nbsp;<i>(${relation.label})</i>`, 
              input_type: "section_header"
            });
            /*
            fields.push({
              //label: "<hr>"+req.__("Views for table"),
              label: req.__("Views for table"),
              input_type: "custom_html", 
              attributes: { 
                //html: `<hr style="padding_bottom:0;"><b>${related_table.name}&nbsp;<i>(${relation.label})</i></b>`
                html: `<div style="border-top: 1px solid silver;"><b>${related_table.name}&nbsp;<i>(${relation.label})</i></b></div>`
              } 
            });
            */

            for (const view of views) {
              const specName = `ChildList:${view.name}.${related_table.name}.${relation.name}`;
              const safeSpec = encodeSubKey(specName);
              const safeLabelSpec = encodeSubKey(`ChildList_label:${view.name}.${related_table.name}.${relation.name}`);
              fields.push({
                name: safeSpec,
                //label: `<b>${related_table.name}</b>&nbsp;<i>(${relation.label})</i><br>→&nbsp;<b><u>${view.name}</u></b>`,
                //label: ` ➜→&nbsp;<b><u>${view.name}</u></b><br><b>${related_table.name}</b>&nbsp;<i>(${relation.label})</i>`,
                //label: ` ➜&nbsp;<b>${view.name}</b><br>${related_table.name}&nbsp;<i>(${relation.label})</i>`,
                label: view.name,
                type: "Bool",
              });
              fields.push({
                name: safeLabelSpec,
                label: req.__("Custom title"),
                sublabel: req.__("Leave empty to use table description or name"),
                type: "String",
                showIf: { [safeSpec]: true },
              });
            }
          }

          // Parent views (many-to-one relationships)
          const parent_views = await get_parent_views(tbl, context.viewname);
          for (const { relation, related_table, views } of parent_views) {
            // Add a section pour every table
            fields.push({
              label: req.__("Views for table") + ": " + related_table.name, 
              input_type: "section_header"
            });
            for (const view of views) {
              const specName = `ParentShow:${view.name}.${related_table.name}.${relation.name}`;
              const safeSpec = encodeSubKey(specName);
              const safeLabelSpec = encodeSubKey(`ParentShow_label:${view.name}.${related_table.name}.${relation.name}`);
              fields.push({
                name: safeSpec,
                //label: `<b>${related_table.name}</b>&nbsp;<i>(${relation.label})</i><br>→&nbsp;<b><u>${view.name}</u></b>`,
                label: view.name,
                type: "Bool",
              });
              fields.push({
                name: safeLabelSpec,
                label: req.__("Custom title"),
                sublabel: req.__("Leave empty to use table description or name"),
                type: "String",
                showIf: { [safeSpec]: true },
              });
            }
          }

          // List-mode heading level selector (shown only when display = list)
          fields.unshift({
            name: "list_heading_level",
            label: req.__("List heading level"),
            sublabel: req.__("HTML heading tag used for each subtable title"),
            type: "String",
            required: true,
            default: "h6",
            attributes: {
              options: ["h1", "h2", "h3", "h4", "h5", "h6"],
            },
            showIf: { subtables_display: "list" },
          });

          // Display mode selector (shown first in the form)
          fields.unshift({
            name: "subtables_display",
            label: req.__("Subtables display"),
            sublabel: req.__("How to display multiple subtables"),
            type: "String",
            required: true,
            default: "tabs",
            attributes: {
              options: ["tabs", "pills", "accordion", "list"],
            },
          });
          return new Form({
            fields,
            labelCols: 4,
            blurb: req.__(
              "Which related tables would you like to show in sub-lists below the selected item?"
            ),
          });
        },
      },
    ],
  });

// ─────────────────────────────────────────────────────────────
// State fields
// ─────────────────────────────────────────────────────────────

/**
 * Declare state fields accepted by this viewtemplate.
 *
 * Always exposes an optional `id` field. If a list view is configured,
 * its own state fields are also forwarded so that URL query parameters
 * can filter the list.
 *
 * @param {number} table_id
 * @param {string} viewname
 * @param {object} config - View configuration
 * @returns {Promise<object[]>} Array of state field descriptors
 */
const get_state_fields = async (
  table_id,
  viewname,
  { list_view, show_view }
) => {
  const id = { name: "id", type: "Integer", required: false };
  if (list_view) {
    const lview = await View.findOne({ name: list_view });
    if (lview) {
      const lview_sfs = await lview.get_state_fields();
      return [id, ...lview_sfs];
    }
  }
  return [id];
};

// ─────────────────────────────────────────────────────────────
// Split pane CSS & JS helpers
// ─────────────────────────────────────────────────────────────

/**
 * Sanitize a view name into a string safe for use in CSS class names and DOM ids.
 *
 * @param {string} viewname
 * @returns {string} Alphanumeric + underscore only
 */
function safeId(viewname) {
  return viewname.replace(/[^a-zA-Z0-9_]/g, "_");
}

/**
 * Generate a `<style>` block for the split pane layout.
 *
 * Creates scoped CSS classes using the sanitized view name as suffix
 * to avoid collisions when multiple ListShowListEnhanced views coexist on one page.
 *
 * @param {string} viewname - The view name (used to scope CSS classes)
 * @param {string} orientation - "horizontal" or "vertical"
 * @param {string} [splitHeight] - Optional CSS height (e.g. "600px", "80vh") for vertical mode
 * @returns {string} HTML `<style>` element
 */
function splitPaneCSS(viewname, orientation, splitHeight, handleColor) {
  const sid = safeId(viewname);
  const isVertical = orientation === "vertical";
  const cursor = isVertical ? "row-resize" : "col-resize";
  const flexDir = isVertical ? "column" : "row";

  const idleBg = handleColor || "#dee2e6";
  const hoverBg = handleColor || "#adb5bd";
  // When a custom color is set, use a brightness filter on hover so the
  // visual feedback remains regardless of the chosen hue.
  const hoverExtra = handleColor ? "filter: brightness(0.85) !important;" : "";
  // Custom color must override theme/Bootstrap rules that may target
  // the handle with equal or higher specificity.
  const bgImportant = handleColor ? " !important" : "";

  return `<style id="xlsl-split-css-${sid}">
  .xlsl-split-container-${sid} {
    display: flex;
    flex-direction: ${flexDir};
    width: 100%;
    min-height: 200px;
    ${isVertical && splitHeight ? `height: ${splitHeight};` : ""}
  }
  .xlsl-split-panel-${sid} {
    overflow: auto;
    flex: 1 1 50%;
  }
  .xlsl-split-handle-${sid} {
    flex: 0 0 6px;
    background: ${idleBg}${bgImportant};
    cursor: ${cursor};
    position: relative;
    z-index: 10;
    transition: background 0.15s, filter 0.15s;
  }
  .xlsl-split-handle-${sid}:hover,
  .xlsl-split-handle-${sid}.xlsl-dragging {
    background: ${hoverBg}${bgImportant};
    ${hoverExtra}
  }
</style>`;
}

/**
 * Generate a `<script>` block for split pane drag-to-resize behaviour.
 *
 * Features:
 * - Mouse and touch support for the drag handle
 * - Cookie-based persistence of the split ratio (1 year expiry)
 * - Auto-fit height in vertical mode when no explicit height is set
 *   (calculates remaining viewport space below the container)
 * - Deduplication guard: only initialises once per view instance
 * - Dynamic orientation detection: when responsive mode is enabled,
 *   the script reads the computed flex-direction at drag time so that
 *   it adapts when a CSS media query switches from horizontal to vertical
 *
 * @param {string} viewname - The view name (used to scope selectors and cookie name)
 * @param {string} orientation - "horizontal" or "vertical"
 * @param {string} [splitHeight] - If set, disables auto-fit height in vertical mode
 * @param {boolean} [responsive=false] - If true, detect orientation dynamically via computed style
 * @returns {string} HTML `<script>` element
 */
function splitPaneJS(viewname, orientation, splitHeight, responsive) {
  const sid = safeId(viewname);
  const isVertical = orientation === "vertical";
  const cookieName = `xlsl_split_${sid}`;

  return `<script>
(function() {
  var initId = 'xlsl-split-initialized-${sid}';
  if (document.getElementById(initId)) return;

  var container = document.querySelector('.xlsl-split-container-${sid}');
  if (!container) return;

  var marker = document.createElement('span');
  marker.id = initId;
  marker.style.display = 'none';
  container.appendChild(marker);

  // Detect current orientation dynamically (supports responsive media query switch)
  function isCurrentlyVertical() {
    ${responsive
      ? `return window.getComputedStyle(container).flexDirection === 'column';`
      : `return ${isVertical};`
    }
  }

  ${isVertical && !splitHeight ? `
  // Auto-fit height to remaining viewport space below the container
  function fitHeight() {
    var top = container.getBoundingClientRect().top;
    container.style.height = (window.innerHeight - top - 20) + 'px';
  }
  fitHeight();
  window.addEventListener('resize', fitHeight);
  ` : responsive ? `
  // Responsive: auto-fit height only when the layout has switched to vertical
  function fitHeight() {
    if (isCurrentlyVertical()) {
      var top = container.getBoundingClientRect().top;
      container.style.height = (window.innerHeight - top - 20) + 'px';
    } else {
      container.style.height = '';
    }
  }
  fitHeight();
  window.addEventListener('resize', fitHeight);
  ` : ""}

  var handle = container.querySelector('.xlsl-split-handle-${sid}');
  var panelA = container.children[0];
  var panelB = container.children[2];

  function getCookie(name) {
    var parts = ('; ' + document.cookie).split('; ' + name + '=');
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  function setCookie(name, value) {
    document.cookie = name + '=' + value + ';path=/;max-age=31536000;SameSite=Lax';
  }

  function applyRatio(pct) {
    panelA.style.flex = '0 0 ' + pct + '%';
    panelB.style.flex = '0 0 ' + (100 - pct) + '%';
  }

  // Restore saved split position from cookie
  var saved = getCookie('${cookieName}');
  if (saved) {
    var pct = parseFloat(saved);
    if (!isNaN(pct) && pct > 10 && pct < 90) applyRatio(pct);
  }

  // ── Mouse drag ──
  var dragging = false;
  handle.addEventListener('mousedown', function(e) {
    e.preventDefault();
    dragging = true;
    handle.classList.add('xlsl-dragging');
    document.body.style.cursor = isCurrentlyVertical() ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', function(e) {
    if (!dragging) return;
    var rect = container.getBoundingClientRect();
    var pct;
    if (isCurrentlyVertical()) {
      pct = ((e.clientY - rect.top) / rect.height) * 100;
    } else {
      pct = ((e.clientX - rect.left) / rect.width) * 100;
    }
    pct = Math.max(10, Math.min(90, pct));
    applyRatio(pct);
  });

  document.addEventListener('mouseup', function() {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('xlsl-dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    var style = panelA.style.flex;
    var match = style.match(/([\\d.]+)%/);
    if (match) setCookie('${cookieName}', match[1]);
  });

  // ── Touch drag (mobile) ──
  handle.addEventListener('touchstart', function(e) {
    e.preventDefault();
    dragging = true;
    handle.classList.add('xlsl-dragging');
  }, { passive: false });

  document.addEventListener('touchmove', function(e) {
    if (!dragging) return;
    var touch = e.touches[0];
    var rect = container.getBoundingClientRect();
    var pct;
    if (isCurrentlyVertical()) {
      pct = ((touch.clientY - rect.top) / rect.height) * 100;
    } else {
      pct = ((touch.clientX - rect.left) / rect.width) * 100;
    }
    pct = Math.max(10, Math.min(90, pct));
    applyRatio(pct);
  }, { passive: true });

  document.addEventListener('touchend', function() {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('xlsl-dragging');
    var style = panelA.style.flex;
    var match = style.match(/([\\d.]+)%/);
    if (match) setCookie('${cookieName}', match[1]);
  });
})();
</script>`;
}

// ─────────────────────────────────────────────────────────────
// Style helpers
// ─────────────────────────────────────────────────────────────

/**
 * Build an inline CSS style string for a panel.
 *
 * Padding direction depends on orientation:
 * - Horizontal: padding-left / padding-right
 * - Vertical: padding-top / padding-bottom
 *
 * @param {string|null} bgColor - CSS background color, or null/empty to skip
 * @param {number} padding - Padding value in pixels (0 to skip)
 * @param {boolean} isVertical - Whether the layout is in vertical orientation
 * @returns {string|undefined} Inline style string, or undefined if no styles apply
 */
function panelStyle(bgColor, hPadding, vPadding, isVertical) {
  const parts = [];
  if (bgColor) parts.push(`background-color:${bgColor}`);
  if (hPadding) {
      parts.push(`padding-left:${hPadding}px;padding-right:${hPadding}px`);
  }
  if (vPadding) {
    parts.push(`padding-top:${vPadding}px;padding-bottom:${vPadding}px`);
  }
  return parts.length > 0 ? parts.join(";") : undefined;
}

/**
 * Generate a `<style>` block with a media query that forces vertical layout
 * on screens narrower than 768px.
 *
 * Handles both split pane mode (override flex-direction + handle cursor) and
 * Bootstrap grid mode (override col-sm-* to full width and stack vertically).
 *
 * @param {string} viewname - The view name (used to scope CSS classes)
 * @param {boolean} splitView - Whether split pane mode is active
 * @returns {string} HTML `<style>` element, or empty string if not needed
 */
function responsiveCSS(viewname, splitView) {
  const sid = safeId(viewname);
  if (splitView) {
    return `<style id="xlsl-responsive-css-${sid}">
  @media (max-width: 767px) {
    .xlsl-split-container-${sid} {
      flex-direction: column !important;
    }
    .xlsl-split-handle-${sid} {
      cursor: row-resize !important;
    }
  }
</style>`;
  }
  // Grid mode: force columns to stack
  return `<style id="xlsl-responsive-css-${sid}">
  @media (max-width: 767px) {
    .xlsl-responsive-row-${sid} {
      flex-direction: column !important;
    }
    .xlsl-responsive-row-${sid} > [class*="col-sm-"] {
      width: 100% !important;
      max-width: 100% !important;
      flex: 0 0 100% !important;
    }
  }
</style>`;
}

// ─────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────

/**
 * Render the ListShowListEnhanced view.
 *
 * Renders three sections:
 * 1. The list panel (left or top depending on orientation)
 * 2. The detail/show panel (right or bottom)
 * 3. Subtable views below the detail panel
 *
 * Layout modes:
 * - **Grid mode** (split_view=false): uses Bootstrap `row`/`col-sm-*` for horizontal,
 *   stacked divs for vertical
 * - **Split pane mode** (split_view=true): flex container with a draggable handle
 *
 * @param {number} table_id - ID of the table this view is bound to
 * @param {string} viewname - Name of this view instance
 * @param {object} config - View configuration from the workflow
 * @param {object} state - Current URL/query state
 * @param {object} extraArgs - Extra arguments (req, res, etc.)
 * @param {object} queries - Query functions (getRowQuery)
 * @returns {Promise<string>} Rendered HTML
 */
const run = async (
  table_id,
  viewname,
  {
    list_view,
    show_view,
    list_width,
    subtables,
    split_view,
    split_height,
    use_handle_color,
    handle_color,
    orientation,
    responsive,
    use_list_bg_color,
    list_bg_color,
    list_h_padding,
    list_v_padding,
    use_show_bg_color,
    show_bg_color,
    show_h_padding,
    show_v_padding,
  },
  state,
  extraArgs,
  { getRowQuery }
) => {
  const table = Table.findOne({ id: table_id });
  const fields = table.getFields();
  readState(state, fields);

  const isVertical = orientation === "vertical";

  // ── Render the list view ──
  var lresp;
  if (list_view) {
    const lview = await View.findOne({ name: list_view });
    if (!lview)
      throw new InvalidConfiguration(
        `View ${viewname} incorrectly configured: cannot find view ${list_view}`
      );
    const state1 = lview.combine_state_and_default_state(state);
    lresp = await lview.run(state1, {
      ...extraArgs,
      onRowSelect: (v) => `select_id('${v.id}', this)`,
      removeIdFromstate: true,
    });
  }

  // ── Render the detail/show view ──
  var sresp = "";
  if (show_view) {
    const sview = await View.findOne({ name: show_view });
    if (!sview)
      throw new InvalidConfiguration(
        `View ${viewname} incorrectly configured: cannot find view ${show_view}`
      );
    sresp = await sview.run(state, extraArgs);
  }

  // ── Subtables ──
  // The subtables_display setting is stored alongside subtable specs in the
  // "subtables" contextField object — extract it before decoding the rest.
  const subtables_display = (subtables || {}).subtables_display || "tabs";
  const list_heading_level = (subtables || {}).list_heading_level || "h6";

  // Decode hex-encoded subtable keys back to their original "Type:view.table.field" format
  const decodedSubtables = {};
  for (const key of Object.keys(subtables || {})) {
    if (key === "subtables_display" || key === "list_heading_level") continue;
    decodedSubtables[decodeSubKey(key)] = subtables[key];
  }

  // Map heading level string → markup tag function
  const headingTags = { h1, h2, h3, h4, h5, h6 };
  const listHeadingTag = headingTags[list_heading_level] || h6;

  var reltbls = {};
  var myrow;
  const { uniques } = splitUniques(fields, state, true);

  if (Object.keys(uniques).length > 0) {
    var id;
    if (state.id) id = state.id;
    else {
      myrow = getRowQuery(uniques);
      if (!myrow) return `Not found`;
      id = myrow.id;
    }

    // Iterate over enabled subtable specs and render each sub-view
    for (const relspec of Object.keys(decodedSubtables)) {
      if (decodedSubtables[relspec]) {
        const [reltype, rel] = relspec.split(":");
        switch (reltype) {
          case "ChildList":
          case "OneToOneShow":
            const [vname, reltblnm, relfld] = rel.split(".");
            const subview = await View.findOne({ name: vname });
            if (!subview)
              throw new InvalidConfiguration(
                `View ${viewname} incorrectly configured: cannot find view ${vname}`
              );
            else {
              const allPagings = extractPagings(state);
              const subresp = await subview.run(
                { [relfld]: id, ...allPagings },
                extraArgs
              );
              const customLabel = decodedSubtables[`${reltype}_label:${rel}`];
              const childTbl = Table.findOne({ name: reltblnm });
              const childLabel = customLabel || childTbl?.description || reltblnm;
              reltbls[childLabel] = subresp;
            }
            break;
          case "ParentShow":
            const [pvname, preltblnm, prelfld] = rel.split(".");
            if (!myrow) myrow = await getRowQuery({ id });
            if (!myrow) continue;
            const psubview = await View.findOne({ name: pvname });
            if (!psubview)
              throw new InvalidConfiguration(
                `View ${viewname} incorrectly configured: cannot find view ${pvname}`
              );
            else {
              const psubresp = await psubview.run(
                { id: myrow[prelfld] },
                extraArgs
              );
              const pcustomLabel = decodedSubtables[`ParentShow_label:${rel}`];
              const parentTbl = Table.findOne({ name: preltblnm });
              const parentLabel = pcustomLabel || parentTbl?.description || prelfld;
              reltbls[parentLabel] = psubresp;
            }
            break;
          default:
            break;
        }
      }
    }
  }

  // Scoped style: add breathing room above tab/pill panes. Targets only the
  // tab-content directly inside our subview container, so embedded subviews
  // that happen to render their own tab-content elsewhere are unaffected.
  const subtableStyle =
    `<style>.xlsl-subview-container > .tab-content{padding-top:16px;}</style>`;

  // ── Build subtable HTML according to the chosen display mode ──
  const relTblResp = (() => {
    const keys = Object.keys(reltbls);
    if (keys.length === 0) return "";

    // Single subtable: simple heading + content
    if (keys.length === 1) {
      return div(
        { class: "xlsl-subview-container" },
        listHeadingTag(keys[0]),
        reltbls[keys[0]]
      );
    }

    const mode = subtables_display || "tabs";
    let inner;

    if (mode === "list") {
      // Stacked list: each subtable with its own heading at configurable level
      inner = keys.map((k) =>
        div({ class: "xlsl-subview-container" }, listHeadingTag(k), reltbls[k])
      ).join("");
    } else if (mode === "accordion") {
      // Bootstrap 5 accordion: first item expanded by default
      const sid = safeId(viewname);
      const items = keys.map((k, ix) => {
        const itemId = `xlsl-acc-${sid}-${ix}`;
        return div(
          { class: "accordion-item" },
          h2(
            { class: "accordion-header", id: `${itemId}-head` },
            button(
              {
                class: ["accordion-button", ix > 0 && "collapsed"],
                type: "button",
                "data-bs-toggle": "collapse",
                "data-bs-target": `#${itemId}`,
                "aria-expanded": ix === 0 ? "true" : "false",
                "aria-controls": itemId,
              },
              k
            )
          ),
          div(
            {
              id: itemId,
              class: ["accordion-collapse collapse", ix === 0 && "show"],
              "aria-labelledby": `${itemId}-head`,
              "data-bs-parent": `#xlsl-acc-${sid}`,
            },
            div({ class: "accordion-body" }, reltbls[k])
          )
        );
      }).join("");
      inner = div(
        { class: "accordion xlsl-subview-container", id: `xlsl-acc-${sid}` },
        items
      );
    } else if (mode === "pills") {
      // Custom pill switcher implementation (does not rely on Bootstrap's
      // data-bs-toggle delegation, which can be intercepted by pjax/embed
      // wrappers). Each tab uses an inline onclick to toggle .active and
      // .show classes manually. IDs are scoped by view name + index so
      // labels can contain any character and multiple instances coexist.
      const sid = safeId(viewname);
      const groupId = `xlsl-pills-${sid}`;
      const paneId = (ix) => `xlsl-pill-${sid}-${ix}`;
      const tabId = (ix) => `${paneId(ix)}-tab`;
      // Inline JS handler — kept short on purpose; relies only on plain
      // DOM APIs so it works regardless of jQuery/Bootstrap availability.
      const onClick = (ix) =>
        `event.preventDefault();` +
        `var g=document.getElementById('${groupId}');` +
        `if(!g) return;` +
        `g.querySelectorAll('.nav-link').forEach(function(el,i){` +
        `el.classList.toggle('active', i===${ix});` +
        `el.setAttribute('aria-selected', i===${ix}?'true':'false');});` +
        `g.querySelectorAll('.tab-pane').forEach(function(el,i){` +
        `el.classList.toggle('active', i===${ix});` +
        `el.classList.toggle('show', i===${ix});});`;

      const lis = keys.map((k, ix) =>
        li(
          { class: "nav-item" },
          a(
            {
              class: ["nav-link", ix === 0 && "active"],
              href: `#${paneId(ix)}`,
              id: tabId(ix),
              role: "tab",
              "aria-selected": ix === 0 ? "true" : "false",
              onclick: onClick(ix),
            },
            text(k)
          )
        )
      ).join("");
      const panes = keys.map((k, ix) =>
        div(
          {
            class: ["tab-pane fade", ix === 0 && "show active"],
            id: paneId(ix),
            role: "tabpanel",
            "aria-labelledby": tabId(ix),
          },
          reltbls[k]
        )
      ).join("");
      inner = div(
        { class: "xlsl-subview-container", id: groupId },
        ul({ class: "nav nav-pills", role: "tablist" }, lis),
        div({ class: "tab-content", style: "padding-top:16px;" }, panes)
      );
    } else {
      // Tabs (default): use the saltcorn-markup tabs() component
      inner = div({ class: "xlsl-subview-container" }, tabs(reltbls));
    }
    return subtableStyle + inner;
  })();

  // ── No list view configured: show detail only ──
  if (!lresp) {
    return div(
      div(
        {
          class: "d-inline",
          "data-sc-embed-viewname": show_view,
          style: panelStyle(use_show_bg_color ? show_bg_color : null, show_h_padding, show_v_padding, isVertical),
        },
        sresp
      ),
      relTblResp
    );
  }

  // ── Full-width list (list_width=12): no detail panel ──
  if (!split_view && list_width === 12) return lresp;

  const listStyle = panelStyle(use_list_bg_color ? list_bg_color : null, list_h_padding, list_v_padding, isVertical);
  const showStyle = panelStyle(use_show_bg_color ? show_bg_color : null, show_h_padding, show_v_padding, isVertical);

  const respCSS = responsive && !isVertical ? responsiveCSS(viewname, split_view) : "";

  // ── Split pane mode ──
  if (split_view) {
    const sid = safeId(viewname);
    const css = splitPaneCSS(
      viewname,
      orientation,
      split_height,
      use_handle_color ? handle_color : null
    );
    const js = splitPaneJS(viewname, orientation, split_height, responsive);

    return (
      css +
      respCSS +
      div(
        { class: `xlsl-split-container-${sid}` },
        div(
          {
            class: `xlsl-split-panel-${sid} xlsl-list-container`,
            style: listStyle,
          },
          lresp
        ),
        div({ class: `xlsl-split-handle-${sid} xlsl-handle-container` }),
        div(
          {
            class: `xlsl-split-panel-${sid} xlsl-show-container`,
            style: showStyle,
          },
          div(
            {
              class: "d-inline xlsl-embed-container",
              "data-sc-embed-viewname": show_view,
            },
            sresp
          ),
          relTblResp
        )
      ) +
      js
    );
  }

  // ── Bootstrap grid mode — vertical ──
  if (isVertical) {
    return div(
      div({ style: listStyle }, lresp),
      div(
        { style: showStyle },
        div(
          {
            class: "d-inline",
            "data-sc-embed-viewname": show_view,
          },
          sresp
        ),
        relTblResp
      )
    );
  }

  // ── Bootstrap grid mode — horizontal (default) ──
  const sid = safeId(viewname);
  return (
    respCSS +
    div(
    { class: `row${responsive ? ` xlsl-responsive-row-${sid}` : ""}` },
    div({ class: `col-sm-${list_width || 6} xlsl-list-container`, style: listStyle }, lresp),
    div(
      { class: `col-sm-${12 - (list_width || 6)} xlsl-show-container`, style: showStyle },
      div(
        {
          class: "d-inline xlsl-embed-container",
          "data-sc-embed-viewname": show_view,
        },
        sresp
      ),
      relTblResp
    )
  ));
};

// ─────────────────────────────────────────────────────────────
// Viewtemplate definition
// ─────────────────────────────────────────────────────────────

/**
 * The ListShowListEnhanced viewtemplate descriptor.
 *
 * @type {object}
 * @property {string} name - Viewtemplate name shown in the Saltcorn UI
 * @property {string} description - Short description of the viewtemplate
 * @property {Function} configuration_workflow - Returns the config Workflow
 * @property {Function} run - Renders the view HTML
 * @property {Function} get_state_fields - Declares accepted URL state fields
 * @property {Function} queries - Provides data-fetching functions to run()
 * @property {Function} connectedObjects - Lists embedded views for dependency tracking
 */
const ListShowListEnhanced = {
  name: "Enhanced ListShowList",
  description:
    "Enhanced list-detail view with resizable split pane, orientation control, and per-panel styling",
  configuration_workflow,
  run,
  get_state_fields,
  queries: ({
    table_id,
    viewname,
    configuration: { columns, default_state },
    req,
  }) => ({
    /**
     * Fetch a single joined row by unique field values.
     * Used to retrieve the selected row for the detail view and subtables.
     *
     * @param {object} uniques - Key-value pairs identifying the row
     * @returns {Promise<object|null>} The matched row or null
     */
    async getRowQuery(uniques) {
      const table = Table.findOne({ id: table_id });
      return await table.getJoinedRow({
        where: uniques,
        forUser: req.user,
        forPublic: !req.user,
      });
    },
  }),

  /**
   * List all views embedded by this viewtemplate (list view + subtable views).
   * Used by Saltcorn for dependency tracking and pack export.
   *
   * @param {object} config - View configuration
   * @returns {Promise<{embeddedViews: View[]}>}
   */
  connectedObjects: async ({ list_view, subtables }) => {
    const subViews = [];
    for (const encodedKey of Object.keys(subtables || {})) {
      if (subtables[encodedKey]) {
        const relspec = decodeSubKey(encodedKey);
        const [reltype, rel] = relspec.split(":");
        switch (reltype) {
          case "ChildList":
          case "OneToOneShow":
            const [vname] = rel.split(".");
            const view = View.findOne({ name: vname });
            if (view) subViews.push(view);
            break;
          case "ParentShow":
            const [pvname] = rel.split(".");
            const pView = View.findOne({ name: pvname });
            if (pView) subViews.push(pView);
            break;
          default:
            break;
        }
      }
    }
    const listView = View.findOne({ name: list_view });
    if (listView) subViews.push(listView);
    return { embeddedViews: subViews };
  },
};

// ─────────────────────────────────────────────────────────────
// Plugin export
// ─────────────────────────────────────────────────────────────

module.exports = {
  sc_plugin_api_version: 1,
  plugin_name: "listshowlist-enhanced",
  viewtemplates: [ListShowListEnhanced],
};
