---
layout: post
category: Go
title: go常见的数据问题和高性能编程
tagline: by 空谷残声
tags: 
  - mysql
---


常见的一些问题  
-------
1.在函数调用过程中，数组是值传递pass-by-value，必要时必须使用slice。因为slice是引用类型，在slice传参时，只会复制slice的Data指针和len、cap，形参和实参的slice使用的是同一个底层数组。

2.Map 的有序性先说结论，在 golang 中 map 是无序的，准确的说是无法严格保证顺序的， golang 中 map 在扩容后，可能会将部分 key 移至新内存，由于在扩容搬移数据过程中，并未记录原数据位置， 并且在 golang 的数据结构中也并未保存数据的顺序，所以那么这一部分在扩容后实际上就已经是无序的了。遍历的过程，其实就是按顺序遍历内存地址，同时按顺序遍历内存地址中的 key。但这时已经是无序的了。但是如果我就一个 map，我保证不会对 map 进行修改删除等操作，那么按理说没有扩容就不会发生改变。但也是因为这样，GO 才在源码中 但是有一个有趣的现象，就算不对 map 进行插入删除等操作致使其扩容，其在遍历过程中仍是无序的。这是因为 golang 官方在设计时故意加上随机的元素，将遍历 map 的顺序随机化，用来防止使用者用来顺序遍历。依赖 map 的顺序进行遍历，这是有风险的代码，在 GO 的严格语法规则下，是坚决不提倡的。所以我们在使用 map 时一定要记得其是无序的，不要依赖其顺序。Map 的并发首先我们大家都知道，在 golang 中 map 并不是一个并发安全的数据结构，当几个 goruotine 同时对一个 map 进行读写操作时，就会出现并发写问题：fatal error: concurrent map writes。但是为什么 map 是不支持并发安全的呢， 主要是因为成本与效益。官方答复原因如下：

*典型使用场景：map 的典型使用场景是不需要从多个 goroutine 中进行安全访问。

*非典型场景（需要原子操作）：map 可能是一些更大的数据结构或已经同步的计算的一部分。

性能场景考虑：若是只是为少数程序增加安全性，导致 map 所有的操作都要处理 mutex，将会降低大多数程序的性能。同时 golang 提供了并发安全的 sync map。

3.切片会导致整个数组被锁定，导致底层数组无法及时释放内存，如果底层数组过大，会对内存产生极大的压力。

错误示例：

```
func test() {
    fileMap := make(map[string][]byte)

    for i := 0; i < 10; i++ {
        name := "/data/test/filename_"+strconv.Itoa(i)
        data, err := ioutil.ReadFile(name)
        if err != nil {
            fmt.Println(err)
            continue
        }
        fileMap[name] = data[:1]
   }
   // do some thing
}
```
正确示例：
```
func test() {
    fileMap := make(map[string][]byte)

    for i := 0; i < 10; i++ {
        name := "/data/test/filename_"+strconv.Itoa(i)
        data, err := ioutil.ReadFile(name)
        if err != nil {
            fmt.Println(err)
            continue
        }
        fileMap[name] = append([]byte{}, data[:1]...)
   }
   // do some thing
}
```
4.对于切片的操作，会操作同一个底层数组，因此对于一个切片的修改操作，会影响到整个数组。另外由于string 在go中是immutable，对于同一个字符串的两个变量，Go做了内存优化，会使用的相同的底层数组.

```
func main() {
    slice := []int{1, 2, 3, 4, 5}
    slice1 := slice[:2]
    slice2 := slice[:4]
    fmt.Println("slice: ", slice, ",slice1: ", slice1, ",slice2: ", slice2)
    slice2[0] = 6
    fmt.Println("slice: ", slice, ",slice1: ", slice1, ",slice2: ", slice2)
    
    string1 := "go hello word"
    string2 := "go hello word"
    fmt.Printf("string1 data addr: %d \n", (*reflect.StringHeader)(unsafe.Pointer(&string1)).Data)
    fmt.Printf("string2 data addr: %d \n", (*reflect.StringHeader)(unsafe.Pointer(&string2)).Data)
}

//print:
slice:  [1 2 3 4 5] ,slice1:  [1 2] ,slice2:  [1 2 3 4]
slice:  [6 2 3 4 5] ,slice1:  [6 2] ,slice2:  [6 2 3 4]
string1 data addr: 4333475958 
string2 data addr: 4333475958
```
5.因为defer在函数退出时才会执行，因此不能在循环内部执行defer，否则会导致相关defer操作调用延迟，比如fd会延迟关闭，应将defer包装在func中.

错误示例：
```
func test() {
    for i := 0; i < 5; i++ {
        f, err := os.Open("/data/test/file_"+strconv.Itoa(i))
        if err != nil {
            fmt.Println(err)
            continue
        }
        defer f.Close()
        // do some thing
    }
    // do some thing
}
```

正确示例：
```
func test() {
    for i := 0; i < 5; i++ {
        func() {
            f, err := os.Open("/data/test/file_"+strconv.Itoa(i))
            if err != nil {
                fmt.Println(err)
                return
            }
            defer f.Close()
            // do some thing
        }()
    }
    // do some thing
}
```
6.Go语言是带内存自动回收的特性，因此内存一般不会泄漏。但是Goroutine却存在泄漏的情况，同时泄漏的Goroutine引用的内存也同样无法被回收。因此可通过context包或者退出的channel来避免Goroutine的泄漏。
  
错误示例：
```
func main() {
    ch := func() <-chan int {
        ch := make(chan int)
        go func() {
            for i := 0; ; i++ {
                ch <- i
            }
        } ()
        return ch
    }()

    for value := range ch {
        fmt.Println(value)
        if value == 10 {
            break
        }
    }
    // do some thing
}
```
上面的程序中后台Goroutine向channel输入整数，main函数中输出该整数。但是当值为10时， break跳出for循环，后台Goroutine就处于无法被回收的状态了

正确示例：
```
func main() {
    ctx, cancel := context.WithCancel(context.Background())
    ch := func(ctx context.Context) <-chan int {
        ch := make(chan int)
        go func() {
            for i := 0; ; i++ {
                select {
                case <- ctx.Done():
                    return
                case ch <- i:
                }
            }
        }()
        return ch
    }(ctx)

    for value := range ch {
        if value == 10 {
            cancel()  //通过调用cancel()来通知后台Goroutine退出
            break
        }
    }
    
    // do some thing
}
```
7.go channel注意事项

如果是一个buffer channel，即使被 close， 也可以读到之前存入的值，读取完毕后开始读零值，已经关闭的channel写入则会触发 panic

nil channel 读取和存入都会阻塞，close 会 panic

已经close过的channel再次close会触发panic

关闭channel的原则：不要在消费端进行关闭、不要在有多个并行的生产端关闭

高性能Go编程 
------ 
1.尽可能指定容器容量，以便为容器预先分配内存。这将在后续添加元素时减少通过复制来调整容器大小。
2.如果切片是[]int，切片的Item为int差别不大，但是如果切片Item是一个结构体类型struct{}时，且Item中包含一些比较大内存的成员类型，比如 [2048]byte，如果每次遍历[]struct{} ，都会进行一次值拷贝，所以会带来性能消耗。此外，因为 range 遍历事获取值拷贝的副本，所以对副本的修改，是不会影响到原切片。 如果切片的Item是指针类型，即[]*struct{} 则两者遍历方法都一样。

3.我们一般在做string转[]byte时，会直接进行[]byte(string)，这样的话会发生一次拷贝操作，对于一些长尾的字符串，会产生性能问题。这是因为在Go的设计中string是immutable，而[]byte是mutable，如果不希望进行这次拷贝的消耗，这时候就需要用到unsafe。

[参考](https://pkg.go.dev/reflect#SliceHeader)
```
func string2bytes(s string) []byte {
     stringHeader := (*reflect.StringHeader)(unsafe.Pointer(&s))

     var b []byte
     rs := (*reflect.SliceHeader)(unsafe.Pointer(&b))
     rs.Data = stringHeader.Data
     rs.Len = stringHeader.Len
     rs.Cap = stringHeader.Len
     return b
}
```
需要特别注意的是这样生成的[]byte不可修改，否则会出现未定义的行为

4.Go 中空结构体 struct{} 是不占用内存空间，因此fmt.Println(unsafe.Sizeof(struct{}{})) 为0，不像 C/C++ 中空结构体仍占用 1 字节大小，因此可用于以下几个场景来节省内存：

在实现集合时，可以将map的value的设置为struct{}来节省内存；

在使用不发送数据的channel时，只是用于通知其他Goroutine，也可以使用空结构体；

仅包含方法的结构体，即结构体没有任何成员类型字段;

5.尽量少使用反射，因为反射里边牵扯到类型判断和内存分配，会对性能产生影响。

6.内存管理：

struct结构体内的成员布局需要考虑内存对齐，一般建议字段宽度从小到大由上到下排列，减少内存占用，提高内存读写性能。

值传递会拷贝整个对象，而指针传递只会拷贝对象的地址，指针指向的对象是同一个。返回指针可以减少值的拷贝，但是会导致内存分配逃逸到堆中，即变量逃逸，增加垃圾回收(GC)的负担。在对象频繁创建和删除的场景下，传递指针会导致GC的开销增大，影响性能。一般情况下，对于需要修改原对象值，或占用内存比较大的结构体，选择返回指针。对于只读的或者占用内存较小的结构体，直接返回值性能要优于指针。

对于需要重复分配、回收内存的地方，优先使用sync.Pool进行池化，用来保存和复用对象，减少内存分配，降低GC压力，并且sync.Pool是并发安全的。

7.并发编程：

优先考虑无锁的数据结构使用，即lock-free 比如atomic包，但其底层也是memory barrier，如果并发太高，性能也未必高。

Goroutine局部，即线程的TLS，最后再进行每个Goroutine合并处理。

进行数据切片，减少锁的竞争，或者使用读写锁，替换互斥锁。

对于map数据结构的并发访问，在读多写少的情况下，建议使用官方的sync.Map，sync.Map是空间换时间的实现内部有两个map，有一个专门读的read map，另一个是提供读写的dirty map，优先读read map，未读到会穿透到dirty map，但是不适用于大量写的场景，dirty map会存在频繁刷新为read map，整体性能会降低。

[Goroutine 池化](https://github.com/panjf2000/ants)




总结
----

写go代码时多多思考，如何保证内存不出现泄漏，如何能够更节省资源。好的代码需要精雕细琢。  

[文章来源](https://juejin.cn/post/7129712481986936846)










