# The catalogue: vendors, products, offers

Everything Nido can put in a room or on a wall comes from a **vendor**: a shop, a brand or a marketplace (Servei Estació, Bruguer, Titanlux, IKEA, Amazon). Code: `src/catalog.js`.

## The three records

**Vendor**: who sells.
`name`, `url` (website), `about`, `logo`, `locations[]` (`name`, `address`, `map`: a link to the shop on a map), `curated` (added by Nido, not by the vendor itself).

**Product**: what is sold, described without a price list in mind.

| Field | Meaning |
|---|---|
| `type` | A key of `TYPES`: `moulding`, `paint`, `wallpaper`, `sofa`, `bed`… |
| `name`, `about`, `material`, `color` | Text, and a colour for when there's no picture |
| `image`, `model` | A photo (or a wallpaper's repeat) and an optional 3D model, as `/_blob/<id>` |
| `unit` | What it is sold by: `strip`, `m`, `tin`, `L`, `roll`, `m2`, `piece` |
| `price`, `currency` | Default price for one `unit` |
| `specs[]` | Rows of `key`, `label`, `value`, `unit`, and an optional `price` and `currency` for one of that unit |

**Offer** (the vendor's product): `productId`, `url` (where to buy it), `sku`, and optionally its own `price`, `currency` and `unit`.

Each vendor keeps its own copies of its products, so the records live together in one document per vendor: `shops/<vendorId>` with `products[]` and `offers[]`. A vendor's own shop is `shops/<their user id>`. Nido's admins can write any `shops/<id>`, for vendors that aren't on Nido themselves.

## Prices: the most specific one wins

1. the offer's `price` (this vendor, this listing)
2. the product's `price`
3. the first spec row with a `price`: always for one of the product's `unit` (a strip, a metre), whatever unit the row's own value is in

The app then converts the price to what it needs. A moulding sold at 2.96 € a metre in 2.4 m strips is 7.10 € a strip. Paint sold by the litre in 4 L tins is priced per tin.

## Types: how a product becomes something the app can use

`TYPES` in `src/catalog.js` is the only place that knows what a moulding or a tin of paint is. Each entry has:

- `label` and `group` (`furniture` goes in rooms; `wall` goes on walls)
- `sold`: the units it can be sold by, the first being the default
- `specs`: the rows the editor starts with (`key`, `label`, `unit`, `need`, `options` for a choice)
- `view(product, price)`: turns specs into the shape the 3D and the sums use (`w`, `d`, `h` for furniture, `moulding: { face, depth, len, shape }`, `paint: { tinL, coverage, coats }`…)

The rest of the app never reads specs directly: it asks `allProducts()`, which goes through each type's `view`. To add a type (boards, tools, tiles), add an entry to `TYPES`, and only add 3D or sums if the type needs them.

Specs are converted between units of the same kind (`mm`, `cm`, `m`; `ml`, `L`), so a vendor can type a width in cm or mm. Rows with a name and unit the type doesn't know are kept and shown, but nothing reads them.

## Old shop documents

Shops saved before this (products with `kind`, `w`, `d`, `h`, `paint`, `wallpaper` or `moulding`, and their own `price` and `url`) are read as products plus one offer each. The built-in IKEA and Servei Estació catalogues are still in that format. A product keeps the reference `shop:<vendorId>:<productId>`, so rooms that already use it still find it.
