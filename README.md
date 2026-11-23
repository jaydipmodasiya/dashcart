# dashcart – Furniture Delivered in 30–40 Minutes

An online **furniture store** that works like a quick-commerce app (Blinkit-style): customers browse
**sofas, beds, tables, chairs, trundle beds, canopy beds, footstools, ottoman benches and shoe racks**
from nearby showrooms, pay online, and the order is **delivered in 30–40 minutes** with live tracking.
The website connects customers **directly to the retailer (showroom)** that sells each piece.

| Layer    | Technology                                                                          |
|----------|-------------------------------------------------------------------------------------|
| Frontend | **HTML + CSS + JavaScript** (plain – no frameworks)                                 |
| Backend  | **Java 17+** using only the JDK's built-in web server (no frameworks, no libraries) |
| Storage  | One file (`data/dashcart.db`) written with Java serialization                       |

> Re-design of the earlier *RentEase* (React + Supabase) rental project: same full-stack ideas,
> now a furniture **sales** website rebuilt in HTML/CSS/JS + Java.

---

## 1. How to run

You need the **JDK 17 or newer** (check with `java -version` and `javac -version`).

```
Windows :  double-click run.bat          (or:  run.bat demo)
Linux/Mac: ./run.sh                      (or:  ./run.sh demo)
```

The browser opens automatically at **http://localhost:8080** (open it by hand if it doesn't).
Keep the terminal window open while using the site; press `Ctrl+C` to stop.

> ⚠️ Do **not** double-click `index.html` – the page must be opened through the Java server
> (http://localhost:8080), otherwise it cannot reach the backend.

* **Normal mode** – a real 30–40 minute delivery clock.
* **Demo mode** (`run.sh demo` / `run.bat demo`) – time runs 30× faster, so a whole delivery
  (confirmed → showroom preparing → out for delivery → delivered) finishes in about **70 seconds**.
  Use this for your presentation.

Manual commands:

```
javac -encoding UTF-8 -d backend/out backend/src/dashcart/*.java
java -cp backend/out dashcart.Main 8080 frontend 30
#                                   port  frontend-folder  speed (1 = real time)
```

---

## 2. Features

**Customer side**
* **Redesigned home page:** an illustrated room (dollhouse cutaway) with tappable hotspots – tap the sofa, bed, table, chairs, stool or shoe rack to filter the catalogue
* Colour-swatch category chips, search, sorting (recommended / price / biggest discount) and **showroom rows** with distance bars – tap one to see only its furniture
* Quick-view window for every product, wishlist hearts, and a cart drawer with a free-delivery progress bar
* Two-column checkout with a live order summary, and a delivery-van tracker
* **Current location:** the "Set location" chip in the header asks the browser for your position (GPS / Wi-Fi), shows the area and pincode, and fills the delivery address with one tap. You can also type a city and pincode. Saved in the browser.
* **Responsive on every screen:** small and large phones, phones turned sideways, tablets (portrait and landscape), laptops and large monitors (tested from 320 px to 1920 px wide). Showrooms become a swipeable row on phones and the location window slides up from the bottom. Keyboard friendly, no images to download.
* 29 products in 6 categories: Sofas, Beds, Tables, Chairs, Stools & Benches, Shoe Racks
* Every product shows **which showroom sells it** and how far it is
* Cart drawer with a live bill: items, delivery fee, assembly & handling, ETA, EMI hint
* Register / login
* Checkout: delivery address → payment
* **Payments:** Google Pay (UPI ID), Paytm (UPI ID / mobile), Debit card, Credit card, **EMI** (3 / 6 / 9 / 12 months)
* **Live order tracking:** moving delivery rider, 4 stages, countdown, items grouped by showroom
* Order history

**Business rules (all enforced in Java, in `Store.java`)**

| Rule | Value |
|------|-------|
| Delivery promise | always 30–40 min (a farther showroom adds a few minutes) |
| Delivery fee | ₹199, **free** on furniture orders of ₹4,999 or more |
| Assembly & handling | ₹99 per order |
| EMI | orders of ₹5,000+, credit card only, 13 % p.a. reducing balance |
| Max per item | 5 pieces per order |
| Stock | 10 per item (5 for pieces above ₹30,000); cannot be oversold |

Prices are **recalculated on the server** – the browser's prices are never trusted.
EMI formula: `EMI = P·r·(1+r)ⁿ / ((1+r)ⁿ − 1)` with `r = 13 % ÷ 12`.

---

## 3. Project structure

```
dashcart/
├── run.sh / run.bat            build + start scripts
├── backend/src/dashcart/
│   ├── Main.java               web server, URL routing, serves the frontend
│   ├── Store.java              ALL business logic: catalog, pricing, EMI, payment, orders, stock
│   ├── Models.java             data classes (Product, Retailer, Order, User …)
│   └── Json.java               small JSON reader/writer (replaces external libraries)
├── frontend/
│   ├── index.html              page shell
│   ├── css/style.css           design system and styling (phone, tablet, desktop)
│   ├── fonts/                  Bricolage Grotesque + Figtree, bundled so it works offline
│   └── js/
│       ├── app.js              all browser logic (cart, login, checkout, tracking)
│       └── icons.js            furniture, hero room, van and UI icons (all drawn as SVG code)
└── data/dashcart.db            created automatically (users, orders, stock)
```

```
 Browser (HTML/CSS/JS)  ──fetch() JSON──▶  Main.java (HTTP routes)  ──▶  Store.java (rules)  ──▶  data/dashcart.db
        ▲                                                                       │
        └────────────────────────── JSON response ◀─────────────────────────────┘
```

### REST API

| Method | URL                | Login? | Purpose                                         |
|--------|--------------------|--------|-------------------------------------------------|
| GET    | `/api/catalog`     | no     | showrooms, categories, products, fee rules      |
| POST   | `/api/quote`       | no     | price a cart (bill + EMI plans + ETA)           |
| POST   | `/api/register`    | no     | create account → token                          |
| POST   | `/api/login`       | no     | login → token                                   |
| GET    | `/api/geocode?lat&lon` | no | coordinates → address (OpenStreetMap Nominatim, needs internet) |
| GET    | `/api/me`          | yes    | current user                                    |
| POST   | `/api/orders`      | yes    | validate → pay → reserve stock → create order   |
| GET    | `/api/orders`      | yes    | my orders                                       |
| GET    | `/api/orders/{id}` | yes    | one order with live status                      |

Logged-in requests send the header `Authorization: Bearer <token>`.

---

## 4. Demo script for the faculty presentation (≈ 8 minutes)

1. **Problem & idea (1 min)** – buying furniture is slow (days of waiting); DashCart delivers from nearby showrooms in 30–40 minutes.
2. **Start in demo mode** – `run.sh demo` / `run.bat demo`.
3. **Browse (1 min)** – search "trundle", tap the sofa in the hero room, open the *Shoe Racks* swatch, tap the *Sleep Well Beds* showroom, and open a quick view.
4. **Cart (1 min)** – add the Pull-out Trundle Bed + Round Footstool; show the bill, free delivery and the EMI hint.
5. **Register & checkout (1 min)** – create an account; enter an address (shows validation messages).
6. **Payments (2 min)** – show all five options.
   * Choose **EMI**, switch between 3 / 6 / 9 / 12 months and watch the monthly amount change.
   * Click **Fill test details**. First pay with card `4000 0000 0000 0002` → *"Payment declined"* (error handling).
   * Then use `4111 1111 1111 1111` → success.
7. **Live tracking (1 min)** – watch the rider move; items are grouped by showroom.
8. **Show the code (1–2 min)** – `Store.java` (pricing, stock, payments) and `app.js`.

**Demo / test data**

| What                  | Value                                              |
|-----------------------|----------------------------------------------------|
| Test card (success)   | `4111 1111 1111 1111`, expiry `12/30`, CVV `123`   |
| Test card (declined)  | `4000 0000 0000 0002`                              |
| UPI ID                | `yourname@okhdfcbank`                              |
| Paytm                 | `9876543210` or a UPI ID                           |
| EMI                   | needs a total of ₹5,000+ (most sofas, beds, dining tables) |

---

**Location demo tip:** the browser asks for permission once – click *Allow*. It works on `http://localhost` (browsers only allow location on localhost or HTTPS). Turning the address text into a street name needs internet; without it the app still works and you can type the city and pincode.

## 5. Likely questions from the faculty

**How can furniture arrive in 30–40 minutes?**
Business idea: each partner showroom keeps ready stock near the customer and a nearby rider / mini-truck delivers it –
the same "dark store" idea quick-commerce apps use. The software promises 30–40 minutes
(`ETA = 30 + round(farthest showroom distance in km × 2.5)`, capped between 30 and 40).

**What makes it connect the customer "directly to the retailer"?**
Every product belongs to one showroom (`retailerId`). The order is split by showroom, each showroom is shown on the
checkout/tracking screen, and the showroom's stock is reduced when the order is placed.

**Why plain Java instead of Spring Boot?**
To show the fundamentals: HTTP server, routing, JSON and business logic written by hand. Spring Boot is the natural next step.

**Why does the server re-calculate prices?**
A user can edit JavaScript in the browser. If the server trusted the browser's total, someone could pay ₹1 for a sofa.
`Store.price()` always uses the server's own prices. *(This also fixes the "client-trusted pricing" limitation in the RentEase report.)*

**How do you stop two people buying the last piece?**
Every `Store` method is `synchronized`, so the stock check and stock reduction happen as one step.
Tested with 12 simultaneous buyers for 8 items: exactly 8 succeeded, 4 were told "out of stock".

**Is the payment real?**
No – it is a **simulated gateway**. It validates like a real checkout (UPI format, Luhn card-number check, expiry date, CVV, EMI rules)
but moves no money. A real version would integrate a gateway such as Razorpay or Paytm.

**Is card data safe?**
Only a masked label ("ending 1111") is stored – never the full card number or CVV. Passwords are stored as salted SHA-256 hashes.

**What would you add next?**
A retailer dashboard (accept / reject orders, update stock), a real database (MySQL via JDBC), a real payment gateway,
GPS rider tracking, cancellations / refunds / returns, product photos and reviews.

---

## 6. Honest limitations

* Location detection finds *where you are*; showroom distances in the demo are still fixed sample values (a real app would calculate them from each showroom's coordinates).
* Payment is simulated (no real gateway).
* Delivery tracking is time-based, not GPS.
* Data is stored in one local file – fine for a demo, not for many users (use a SQL database for production).
* Login sessions live in memory, so users log in again after the server restarts.
* There is no retailer/admin screen yet; showrooms and products are defined in `Store.seedCatalog()`.
* Product pictures are drawn with SVG code, not photographs.
* The fee amounts (₹199 delivery, ₹99 assembly) are example values chosen for the demo.

---

## 7. Customise it

* **Add a product:** one line in `Store.seedCatalog()`:
  `product("p30", "Name", "Beds", "bed", "#b07d4f", "Queen · Sheesham wood", 29999, 22999, "r2");`
  (id, name, category, picture type, colour, description, MRP, selling price, showroom id)
* **Picture types** (in `js/icons.js`): `sofa, sofa2, lsofa, armchair, chair, officechair, rocker, bed, trundle, canopy,
  dining, coffee, desk, sidetable, footstool, bench, pouf, shoerack, shoecabinet`
* **Fees / EMI rules:** constants at the top of `Store.java`.
* **Colours:** the `:root { … }` block at the top of `css/style.css`.
* **Rename the brand:** change "dashcart" in `index.html` and the page titles.
