import axios from 'axios'
import cheerio from 'cheerio'
import { Listener } from 'js-simple'
import URI from 'urijs'
import _ from 'lodash'

class Spider {
  constructor () {
    this.axios = axios.create({
      timeout: 10000
    })
    this.requests = []
    this.domains = {}
    this.requestingCount = 0
    this.intervalListener = null
    this.promoteUrl = 'http://bit.ly/2l2UtNk'
  }

  next () {
    if (this.requestingCount === 0 && this.requests.length ===0) {
      console.error('Internal Error: no more urls.')
      process.exit()
    }
    let nextCount = 50 - this.requestingCount
    for (let i = 0; i < nextCount; i++) {
      let request = this.requests.shift()
      if (request) {
        return this.do(request)
      } else {
        break
      }
    }
  }

  addRequest (request, isImportant = false) {
    let uri = URI(request.url)
    let domain = uri.domain()
    if (!this.domains[domain]) {
      this.domains[domain] = {
        count: 0
      }
    }
    if (
      this.domains[domain].count <= 10
    ) {
      // console.log(`Added ${url}`)
      ++this.domains[domain].count
        
      if (isImportant) {
        this.requests.unshift(request)
      } else if (this.requests.length < 1000) {
        this.requests.push(request)
      }
    }
  }

  add (url) {
    let request = {
      url: url,
      method: 'get'
    }
    this.addRequest(request)
  }

  async do (request) {
    try {
      ++this.requestingCount
      if (request.data) {
        console.log(`[${this.requests.length}] Submitted a form: ${request.url} ${JSON.stringify(request.data)}`)
      } else {
        console.log(`[${this.requests.length}] Greping ${request.url}`)
      }
      let response = await this.axios.request(request)
      const $ = cheerio.load(response.data)
      // console.log(response.data)
      try {
        $('form').each((i, form) => {
          try {
            let method = $(form).attr('method') || 'get'
            method = method.toLowerCase()
            let action = $(form).attr('action') || '.'
            let actionUri = URI(action).absoluteTo(request.url).normalize()
            // console.log(`[Form] ${method} ${actionUri.toString()}`)
            let data = {}
            $(form).find('input[type=hidden][name],input[type=text][name],textarea[name]').each((i, input) => {
              let name = $(input).attr('name')
              let value = $(input).attr('value') || this.promoteUrl
              data[name] = value
            })
            $(form).find('radio[name][checked]').each((i, input) => {
              let name = $(input).attr('name')
              let value = $(input).attr('value')
              data[name] = value
            })
            $(form).find('input[type=submit][name]').each((i, input) => {
              let name = $(input).attr('name')
              let value = $(input).attr('value') || 1
              data[name] = value
            })
            if (!_.isEmpty(data) && _.values(data).indexOf(this.promoteUrl) !== -1) {
              let request = {
                url: actionUri.toString(),
                method: method,
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                data: data
              }
              this.addRequest(request, true)
            }
          } catch (error) {
            // console.log(error)
          }
        })
        $('a').each((i, a) => {
          try {
            let href = $(a).attr('href')
            if (href) {
              let hrefUri = URI(href).absoluteTo(request.url).normalize()
              this.add(hrefUri.toString())
            }
          } catch (error) {
            // ignore any error
          }
        })
      } catch (error) {
        console.log('error', error)
      }
      // console.log('#urls:', this.urls.length)
    } catch (error) {
      console.log(error.message)
    } finally {
      --this.requestingCount
    }
  }

  start () {
    this.add('http://www.sh12345.gov.cn/')
    // this.add('http://www.2000fun.com/')
    // this.add('http://www.aligames.com/')
    // this.add('http://www.dawncake.com.tw/leavemessage.php')
    // this.add('https://wtfismyip.com/')
    // this.add('http://medialize.github.io/URI.js/docs.html')
    console.log('spider is starting...')
    this.intervalListener = Listener.setInterval(() => {
      this.next()
    }, 100)
  }

  stop () {
    this.intervalListener.stop()
  }
}

let spider = new Spider()
spider.start()
