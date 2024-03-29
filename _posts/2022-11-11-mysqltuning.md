---
layout: post
category: Go
title: mysql优化
tagline: by 空谷残声
tags: 
  - linux
---

## 最左匹配原则
要想理解联合索引的最左匹配原则，先来理解下索引的底层原理。索引的底层是一颗B+树，那么联合索引的底层也就是一颗B+树，只不过联合索引的B+树节点中存储的是键值。由于构建一棵B+树只能根据一个值来确定索引关系，所以数据库依赖联合索引最左的字段来构建 文字比较抽象 我们看一下
假如我们建立 A,B 联合索引 他们在底层储存是什么样子呢？
橙色代表字段 A
浅绿色 代表字段B
图解：
<img src="/assets/images/tuning_1.png" width="100%" height="100%" />

我们可以看出几个特点
A 是有顺序的 1，1，2，2，3，4
B 是没有顺序的 1，2，1，4，1，2 这个是散列的
如果A是等值的时候 B是有序的 例如 （1，1），（1，2） 这里的B有序的 （2，1）,(2,4) B 也是有序的

这里应该就能看出 如果没有A的支持 B的索引是散列的 不是连续的

MySQL创建联合索引的规则是首先会对联合索引的最左边第一个字段排序，在第一个字段的排序基础上，然后在对第二个字段进行排序。

看到这里还可以明白一个道理 为什么我们建立索引的时候不推荐建立在经常改变的字段 因为这样的话我们的索引结构就要跟着你的改变而改动 所以很消耗性能

## 补充
最左缀原则可以通过跳跃扫描的方式打破 简单整理一下这方面的知识
这个是在 8.0 进行的优化
MySQL8.0版本开始增加了索引跳跃扫描的功能，当第一列索引的唯一值较少时，即使where条件没有第一列索引，查询的时候也可以用到联合索引。
比如我们使用的联合索引是 bcd  但是b中字段比较少 我们在使用联合索引的时候没有 使用 b 但是依然可以使用联合索引
MySQL联合索引有时候遵循最左前缀匹配原则，有时候不遵循。

## 小总结
前提 如果创建 b,c,d 联合索引面

如果 我where 后面的条件是c = 1 and d = 1为什么不能走索引呢 如果没有b的话 你查询的值相当于 *11 我们都知道*是所有的意思也就是我能匹配到所有的数据
如果 我 where 后面是 b = 1 and d =1 为什么会走索引呢？ 你等于查询的数据是 1*1 我可以通过前面 1 进行索引匹配 所以就可以走索引
最左缀匹配原则的最重要的就是 第一个字段

## select *
select * 会走索引
范围查找有概率索引失效但是在特定的情况下会生效 范围小就会使用 也可以理解为 返回结果集小就会使用索引
mysql中连接查询的原理是先对驱动表进行查询操作，然后再用从驱动表得到的数据作为条件，逐条的到被驱动表进行查询。
每次驱动表加载一条数据到内存中，然后被驱动表所有的数据都需要往内存中加载一遍进行比较。效率很低，所以mysql中可以指定一个缓冲池的大小，缓冲池大的话可以同时加载多条驱动表的数据进行比较，放的数据条数越多性能io操作就越少，性能也就越好。所以，如果此时使用select * 放一些无用的列，只会白白的占用缓冲空间。浪费本可以提高性能的机会。

按照评论区老哥的说法 select * 不是造成索引失效的直接原因 大部分原因是 where 后边条件的问题 但是还是尽量少去使用select * 多少还是会有影响的

## 使用函数
因为索引保存的是索引字段的原始值，而不是经过函数计算后的值，自然就没办法走索引了。
不过，从 MySQL 8.0 开始，索引特性增加了函数索引，即可以针对函数计算后的值建立一个索引，也就是说该索引的值是函数计算后的值，所以就可以通过扫描索引来查询数据。

## 计算操作
这个情况和上面一样 之所以会导致索引失效是因为改变了索引原来的值 在树中找不到对应的数据只能全表扫描

索引的时候和查询范围关系也很大 范围过大造成索引没有意义从而失效的情况也不少

## 使用Or导致索引失效
在 WHERE 子句中，如果在 OR 前的条件列是索引列，而在 OR 后的条件列不是索引列，那么索引会失效 举个例子，比如下面的查询语句，b 是主键，e 是普通列，从执行计划的结果看，是走了全表扫描。
这个的优化方式就是 在Or的时候两边都加上索引

## in使用不当
首先使用In 不是一定会造成全表扫描的 IN肯定会走索引，但是当IN的取值范围较大时会导致索引失效，走全表扫描
in 在结果集 大于30%的时候索引失效

## not in 和 In的失效场景相同
## order By
这一个主要是Mysql 自身优化的问题 我们都知道OrderBy 是排序 那就代表我需要对数据进行排序 如果我走索引 索引是排好序的 但是我需要回表 消耗时间 另一种 我直接全表扫描排序 不用回表 也就是

走索引 + 回表
不走索引 直接全表扫描

Mysql 认为直接全表扫面的速度比 回表的速度快所以就直接走索引了  在Order By 的情况下 走全表扫描反而是更好的选择

## 子查询会走索引吗
答案是会 但是使用不好就不会

## 总结
<img src="/assets/images/tuning_2.png" width="100%" height="100%" />


[文章来源](https://juejin.cn/post/7161964571853815822)






















