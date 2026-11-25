# The catalogue: vendors, products, offers

Everything Nido can put in a room, on a floor or on a wall comes from a **vendor**: a shop, a brand or a marketplace (Servei Estació, Bruguer, Titanlux, IKEA, Amazon). Code: `src/catalog.js`.

## The three records

**Vendor**: who sells.
`name`, `url` (website), `about`, `logo`, `locations[]` (`name`, `address`, `map`: a link to the shop on a map), `curated` (added by Nido, not by the vendor itself).

**Product**: what is sold, described without a price list in mind.

| Field | Meaning |
|---|---|
| `type` | A key of `TYPES`: `moulding`, `paint`, `wallpaper`, `flooring`, `sofa`, `bed`… |
| `name`, `about`, `material`, `color` | Text, and a colour for when there's no picture |
| `image`, `model` | A photo (or a wallpaper's repeat) and an optional 3D model, as `/_blob/<id>` |
| `unit` | What it is sold by: `strip`, `m`, `tin`, `L`, `roll`, `m2`, `pack`, `piece` |
| `price`, `currency` | Default price for one `unit` |
| `specs[]` | Rows of `key`, `label`, `value`, `unit`, and an optional `price` and `currency` for one of that unit |

**Offer** (the vendor's product): `productId`, `url` (where to buy it), `sku`, and optionally its own `price`, `currency` and `unit`.

Each vendor keeps its own copies of its products, so the records live together in one document per vendor: `shops/<vendorId>` with `products[]` and `offers[]`. A vendor's own shop is `shops/<their user id>`. Nido's admins can write any `shops/<id>`, for vendors that aren't on Nido themselves.

## Prices: the most specific one wins

1. the offer's `price` (this vendor, this listing)
2. the product's `price`
3. the first spec row with a `price`: always for one of the product's `unit` (a strip, a metre), whatever unit the row's own value is in

The app then converts the price to what it needs. A moulding sold at 2.96 € a metre in 2.4 m strips is 7.10 € a strip. Paint sold by the litre in 4 L tins is priced per tin. Flooring sold by the m² in packs of 2.2 m² is priced per pack.

## Affiliate links

A vendor can carry Nido's own affiliate tracking (only admins set it, in the vendor form):

- `affiliate: { mode: 'wrap', template }`: each link goes through a network's deep link, the product's link URL-encoded where the template says `{url}` (Awin, CJ, Impact, Tradedoubler).
- `affiliate: { mode: 'param', param, value }`: a parameter is added to each link (Amazon's `tag=yourtag-21`).
- `affiliate.disclosure`: the wording shown with those links (a network may require its own, as Amazon does).
- `priceOnSite`: the shop's rules keep prices on its own site (Amazon allows prices only from its own API). Its products show no price, say so, and stay out of shopping totals.

Rooms keep plain links. The tracking is added when a link is drawn (`buyLink` in `src/catalog.js`, `shopLink` in `src/app-ui.js`), so changing an ID reaches every room already made. Tracked links are marked `rel="sponsored"`, and the disclosure is shown wherever one is on screen: under the Catalogue, Add furniture and the Shopping list, and under a single link in a piece's panel or a wall's paint, paper or moulding.

## Types: how a product becomes something the app can use

`TYPES` in `src/catalog.js` is the only place that knows what a moulding or a tin of paint is. Each entry has:

- `label` and `group` (`furniture` goes in rooms; `floor` is laid in a room; `wall` goes on walls)
- `sold`: the units it can be sold by, the first being the default
- `specs`: the rows the editor starts with (`key`, `label`, `unit`, `need`, `options` for a choice)
- `view(product, price)`: turns specs into the shape the 3D and the sums use (`w`, `d`, `h` for furniture, `moulding: { face, depth, len, shape }`, `paint: { tinL, coverage, coats }`, `flooring: { tile, width, pack, surface }`…)

The rest of the app never reads specs directly: it asks `allProducts()`, which goes through each type's `view`. To add a type (boards, tools, tiles), add an entry to `TYPES`, and only add 3D or sums if the type needs them.

## Flooring

A flooring product (parquet, laminate, tiles, stone, vinyl, linoleum, cork, microcement, carpet) has a picture taken straight down and cut so it tiles, the width of floor that picture shows (`repeat`), how much one pack covers (`pack`, optional) and its surface (`FLOOR_SURFACES`). The surface sets how the floor takes the light in 3D (glazed tiles shine, carpet is matte) and whether the room's note suggests more extra for diagonal or herringbone laying (only for floors laid in pieces: wood, tiles, vinyl). A room keeps a copy in `room.flooring`, with its own extra for cuts (10 % to start); the built-in floors (`room.floor`) are what a room has without one. The shopping list adds up every room laid with the same flooring: floor area plus each room's extra, in whole packs, or in m² to a tenth when there's no pack size.

Specs are converted between units of the same kind (`mm`, `cm`, `m`; `ml`, `L`), so a vendor can type a width in cm or mm. Rows with a name and unit the type doesn't know are kept and shown, but nothing reads them.

## Built-in catalogues

Three vendors ship with the app, in `src/data/`: IKEA España, Servei Estació, and **Nido Paint**. The offline app seeds them (`SHOP_SEEDS`, written by `build.mjs`) and the API serves them (`BUILTIN_SHOPS` in `infra/lambda/api.mjs`). An admin's own `shops/<id>` with the same id replaces one, which is how its affiliate tag is set.

Nido Paint is **provisional**: a stand-in brand for wall paint until a paint shop's own catalogue is in Nido. Its ten colours are the app's preset colours, matt, in 4 L tins; each links to a search for paints like it on Amazon (`amazon.es`), so every Nido Paint link can earn a commission once an admin adds the Amazon tag and its disclosure in the vendor form. It keeps `priceOnSite`, as Amazon's rules require, so it shows no prices. Replace it, or remove it from `src/data/`, `build.mjs` and `BUILTIN_SHOPS`, when a real paint catalogue arrives.

## Old shop documents

Shops saved before this (products with `kind`, `w`, `d`, `h`, `paint`, `wallpaper` or `moulding`, and their own `price` and `url`) are read as products plus one offer each. The built-in IKEA and Servei Estació catalogues are still in that format. A product keeps the reference `shop:<vendorId>:<productId>`, so rooms that already use it still find it.
