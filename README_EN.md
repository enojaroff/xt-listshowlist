# Saltcorn ListShowListEnhanced Plugin

A Saltcorn plugin providing an **enhanced list-detail view** with resizable split pane, configurable orientation, and per-panel styling.

## Features

- **Resizable split pane**: drag handle between the list and detail panels (mouse and touch support)
- **Ratio persistence**: split position is saved in a cookie and restored on page reload
- **Orientation**: horizontal (side by side) or vertical (stacked) layout
- **Auto-adaptive height**: in vertical split mode, the view automatically adjusts to the remaining viewport space
- **Per-panel background color**: optional background color for the list and/or detail panel
- **Directional padding**: left/right in horizontal mode, top/bottom in vertical mode
- **Subtables**: display related tables (children and parents) below the detail view
- **Subtable display modes**: tabs, pills, accordion, or stacked list
- **Custom titles**: configurable title for each subtable (defaults to table description or name)
- **Responsive**: automatic switch to vertical layout on screens < 768px (tablets and mobile)

## Installation

### From GitHub (recommended)

In the Saltcorn admin interface: **Settings** → **Plugins** → **Add another plugin**:
- **Source**: `github`
- **Location**: `enojaroff/xt-listshowlist`

### Local plugin

1. Clone the repository: `git clone https://github.com/enojaroff/xt-listshowlist.git`
2. Install from the command line: `saltcorn install-plugin -d /path/to/xt-listshowlist`
   or via the admin interface: **Plugins** → **Add another plugin** → source **Local** → path to the folder
3. Restart Saltcorn

### Via the database

```sql
INSERT INTO _sc_plugins (name, source, location)
VALUES ('@enojaroff/xt-listshowlist', 'local', '/path/to/xt-listshowlist');
```

Then restart Saltcorn.

## Usage

### Creating a ListShowListEnhanced view

1. Go to **Views** → **Create view**
2. Select a table
3. Choose the **ListShowListEnhanced** viewtemplate
4. Configure the two workflow steps

### Step 1: Views & Layout

| Parameter | Type | Description |
| --- | --- | --- |
| **List View** | Select | A list-type view (quantity "Many") used in the left/top panel |
| **Show View** | Select | Detail view displayed when a row is selected |
| **List width** | Integer (1-12) | Bootstrap column width of the list panel (grid mode only) |
| **Orientation** | Select | `horizontal` (side by side) or `vertical` (stacked) |
| **Responsive** | Bool | When enabled, automatically switches to vertical layout on screens < 768px |
| **Show on select** | Bool | When enabled, the detail view updates on row click |
| **Split view** | Bool | Enable the resizable split pane mode |
| **Split height** | String | CSS height of the split container in vertical mode (e.g. `600px`, `80vh`). Only visible when split_view=true and orientation=vertical |
| **List background color** | Bool + Color | Enable and set the list panel background color |
| **List padding** | Integer | Padding in pixels (left/right in horizontal, top/bottom in vertical) |
| **Detail background color** | Bool + Color | Enable and set the detail panel background color |
| **Detail padding** | Integer | Padding in pixels (left/right in horizontal, top/bottom in vertical) |

### Step 2: Subtables

| Parameter | Type | Description |
| --- | --- | --- |
| **Subtables display** | Select | Display mode when there are multiple subtables: `tabs`, `pills`, `accordion`, or `list` |
| **\<Table\> → \<View\>** | Bool | Enable/disable each available subtable |
| **Custom title** | String | Custom title (visible when the subtable is enabled). Empty = table description or name |

## Examples

### Example 1: Simple list-detail (grid mode)

Classic setup with a list on the left and detail on the right:

- **List View**: `Clients List` (List view on the Clients table)
- **Show View**: `Client Detail` (Show view on the Clients table)
- **List width**: `4` (the list takes 4/12 columns, the detail takes 8/12)
- **Orientation**: `horizontal`
- **Split view**: `false`

Result: standard Bootstrap grid with the list in a `col-sm-4` and the detail in a `col-sm-8`.

### Example 2: Resizable split pane

Setup with an interactive split pane:

- **List View**: `Orders List`
- **Show View**: `Order Detail`
- **Orientation**: `horizontal`
- **Split view**: `true`
- **List background color**: enabled → `#f8f9fa` (light grey)
- **Detail padding**: `10`

Result: the two panels are separated by a 6px handle that the user can drag to adjust the split ratio. The position is stored in a cookie.

### Example 3: Vertical layout with accordion subtables

Stacked layout with child tables:

- **List View**: `Products List`
- **Show View**: `Product Detail`
- **Orientation**: `vertical`
- **Split view**: `true`
- **Split height**: *(empty — the height auto-adjusts to the viewport)*
- **Subtables display**: `accordion`
- Enabled subtables:
  - `Reviews List` on the `reviews` table (FK `product_id`) — title: "Customer Reviews"
  - `Variants List` on the `variants` table (FK `product_id`) — title: "Variants"

Result: the product list is on top, the detail below, with a vertical split pane. Below the detail, the two subtables are displayed as a Bootstrap accordion (the first panel is expanded by default).

### Example 4: Detail-only view with pill subtables

When no **List View** is configured, only the detail panel is shown:

- **List View**: *(empty)*
- **Show View**: `Employee Detail`
- **Subtables display**: `pills`
- Enabled subtables:
  - `Contracts List` → title: "Contracts"
  - `Absences List` → title: "Absences"
  - `Evaluations List` → title: "Evaluations"

Result: the employee detail view is displayed directly, followed by three subtables accessible via Bootstrap pills.

### Example 5: Responsive split pane

Horizontal setup that automatically switches to vertical on mobile:

- **List View**: `Tasks List`
- **Show View**: `Task Detail`
- **Orientation**: `horizontal`
- **Responsive**: `true`
- **Split view**: `true`

Result: on desktop, the panels are side by side with a horizontal split pane. On tablet or mobile (< 768px), the layout automatically switches to vertical with the list on top and detail below. The height adjusts to the viewport and the drag handle adapts to the new orientation.

## CSS Classes

The plugin uses specific CSS classes to allow customisation:

| Class | Element |
| --- | --- |
| `lsl2-list-container` | Panel containing the list view |
| `lsl2-show-container` | Panel containing the detail view |
| `lsl2-handle-container` | Split pane drag handle |
| `lsl2-embed-container` | Wrapper around the embedded detail view |
| `lsl2-subview-container` | Container for each subtable |
| `lsl2-split-container-{id}` | Split pane flex container (scoped by view) |
| `lsl2-split-panel-{id}` | Split pane panel (scoped by view) |
| `lsl2-split-handle-{id}` | Split pane handle (scoped by view) |

### Custom CSS example

```css
/* Border on the detail panel */
.lsl2-show-container {
  border-left: 2px solid #dee2e6;
}

/* Handle hover style */
.lsl2-handle-container:hover {
  background: #0d6efd !important;
}

/* Subtable spacing */
.lsl2-subview-container {
  margin-top: 1rem;
}
```

## Rendering Modes

The plugin automatically selects the rendering mode based on the configuration:

| split_view | orientation | Rendering |
|---|---|---|
| `false` | `horizontal` | Bootstrap grid `row` + `col-sm-*` |
| `false` | `vertical` | Stacked divs |
| `true` | `horizontal` | Flex row + col-resize handle |
| `true` | `vertical` | Flex column + row-resize handle |

## License

Apache License 2.0 — see [LICENSE](LICENSE).
