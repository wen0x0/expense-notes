INSERT OR IGNORE INTO categories (id, name, color) VALUES
(1,'Food','#fff4a8'),
(2,'Transport','#c7f9cc'),
(3,'Bills','#ffd6a5'),
(4,'Shopping','#bde0fe'),
(5,'Salary','#d8bbff');

INSERT INTO transactions (category_id,type,amount,note,occurred_at)
SELECT 1,'expense',35000,'Morning coffee','2026-06-21'
WHERE NOT EXISTS (SELECT 1 FROM transactions);
INSERT INTO transactions (category_id,type,amount,note,occurred_at)
SELECT 1,'expense',75000,'Lunch bowl','2026-06-22'
WHERE (SELECT COUNT(*) FROM transactions) = 1;
INSERT INTO transactions (category_id,type,amount,note,occurred_at)
SELECT 2,'expense',12000,'Bus ticket','2026-06-22'
WHERE (SELECT COUNT(*) FROM transactions) = 2;
INSERT INTO transactions (category_id,type,amount,note,occurred_at)
SELECT 3,'expense',220000,'Internet bill','2026-06-23'
WHERE (SELECT COUNT(*) FROM transactions) = 3;
INSERT INTO transactions (category_id,type,amount,note,occurred_at)
SELECT 4,'expense',145000,'Notebook set','2026-06-24'
WHERE (SELECT COUNT(*) FROM transactions) = 4;
INSERT INTO transactions (category_id,type,amount,note,occurred_at)
SELECT 5,'income',12000000,'Monthly salary','2026-06-25'
WHERE (SELECT COUNT(*) FROM transactions) = 5;
