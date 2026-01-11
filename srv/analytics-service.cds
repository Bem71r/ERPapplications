using { my.apmorrowland as my } from '../db/schema';

service AnalyticsService @(path:'/odata/v4/analytics') {

  entity Leaderboard as select from my.Artists as A {
    key A.ID                                      as ID,
        A.name                                    as name,
        A.genre                                   as genre,
        A.country                                 as country,
        cast( avg(A.reviews.rating) as Decimal(3,2) ) as avgRating,
        cast( count(A.reviews.ID)   as Integer      ) as reviewCount
  }
  group by A.ID, A.name, A.genre, A.country
  order by avgRating desc;
}
