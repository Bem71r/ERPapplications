using { my.apmorrowland as my } from '../db/schema';

service AdminService @(path:'/odata/v4/admin') {

  // Draft enkel als je het echt nodig hebt (optioneel)
  // @odata.draft.enabled
  entity Artists       as projection on my.Artists;
  entity Reviews       as projection on my.Reviews;

  entity Stages        as projection on my.Stages;
  entity FestivalDays  as projection on my.FestivalDays;
  entity Performances  as projection on my.Performances;

  entity Customers     as projection on my.Customers;
  entity Products      as projection on my.Products;
  entity Orders        as projection on my.Orders;
  entity OrderItems    as projection on my.OrderItems;
}
