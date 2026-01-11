namespace my.apmorrowland;

using { cuid, managed } from '@sap/cds/common';

/* =========================
   ARTISTS / REVIEWS / PLANNING
   ========================= */

entity Artists : cuid, managed {
  name       : String(111);
  genre      : String(60);
  country    : String(60);
  popularity : Integer;
  bio        : LargeString;

  // Artist -> Reviews (composition: reviews “horen bij” artist)
  reviews    : Composition of many Reviews
                on reviews.artist = $self;

  // Artist -> Performances (composition)
  performances : Composition of many Performances
                  on performances.artist = $self;
}

entity Reviews : cuid, managed {
  artist       : Association to Artists;
  rating       : Integer;          // (1..5 in UI valideren)
  comment      : String(500);
  reviewerName : String(111);
  reviewDate   : Date;
}

entity Stages : cuid, managed {
  name     : String(60);
  capacity : Integer;
}

entity FestivalDays : cuid, managed {
  day   : Date;
  label : String(30);
}

entity Performances : cuid, managed {
  artist     : Association to Artists;
  stage      : Association to Stages;
  festivalDay: Association to FestivalDays;
  startTime  : Time;
  endTime    : Time;
}

/* =========================
   ORDERS / CUSTOMERS / PRODUCTS
   ========================= */

entity Customers : cuid, managed {
  firstName : String(60);
  lastName  : String(60);
  email     : String(255);
}

entity Products : cuid, managed {
  name          : String(111);
  category      : String(30);   // Ticket / Merch / Food
  price         : Decimal(9,2);
  currency_code : String(3) default 'EUR';
}

entity Orders : cuid, managed {
  orderDate     : DateTime;
  status        : String(20);   // Processing / Completed / Cancelled
  orderType     : String(20);   // Tickets / Merch / Food
  currency_code : String(3) default 'EUR';

  customer      : Association to Customers;

  // Order -> Items (composition: items “horen bij” order)
  items         : Composition of many OrderItems
                    on items.order = $self;

  totalAmount   : Decimal(9,2);
}

entity OrderItems : cuid, managed {
  order     : Association to Orders;
  product   : Association to Products;
  quantity  : Integer;
  unitPrice : Decimal(9,2);
  lineTotal : Decimal(9,2);
}
