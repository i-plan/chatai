import {
    getUser,
    addUser,
    checkLoginState
} from '../../services/userApi'
import {
    sendTxt,
    sendImg
} from '../../services/messageApi'
import {
    showMessage
} from '../../utils/toastUtil'
import {
    TimeCode
} from '../../utils/timeUtil'
// 获取全局APP
const app = getApp();
let chatroomConnnector = null
Page({
    /**
     * 页面的初始数据
     */
    data: {
        login: false,
        //输入框距离
        InputBottom: 0,
        roomId: 1,
        chatMsg: {},
        userInfo: {},
        content: '',
        groups: [{
            text: '点歌',
            value: 1
        }],
        voice: false,
        showKeyboard: false,
        sendout: false,
    },
    async selectImg() {
        var that = this;
        let res = await wx.chooseImage({
            count: 1,
            sizeType: ['compressed'],
            sourceType: ['album', 'camera']
        })
        console.log(res)
        res = await wx.getFileSystemManager().readFile({
            filePath: res.tempFilePaths[0], //选择图片返回的相对路径
            encoding: 'base64', //编码格式
        })
        var bufferData = res.data;
        try {
            wx.showLoading({
                title: '信息发送',
                mask: true
            })
            res = await sendImg({
                roomId: that.data.roomId,
                content: bufferData
            });
            console.log(res)
            if (res.result.code == 300) {
                that.setData({
                    errMsg: res.result.msg
                })
            }
        } catch (res) {
            showMessage('网络出现问题')
            console.log(res)
        } finally {
            this.setData({
                content: ''
            })
            wx.hideLoading();
        }

    },
    /**
     * 获取input输入的消息
     */
    moninput: function (e) {
        this.setData({
            sendout: e.detail.value ? true : false,
            content: e.detail.value
        })
    },
    InputFocus(e) {
        this.setData({
            InputBottom: e.detail.height,
        })
    },
    InputBlur(e) {
        this.setData({
            InputBottom: 0
        })
    },
    showAction() {
        wx.showActionSheet({
            itemList: ['A', 'B', 'C'],
            success(res) {
                console.log(res.tapIndex)
            },
            fail(res) {
                console.e(res.errMsg)
            }
        })
    },
    async submit() {
        if (!this.data.content) {
            showMessage('请输入问题')
            return
        }
        var that = this;
        if (this.data.login) {
            //已登录用户
            try {
                wx.showLoading({
                    title: '机器人正在思考...',
                })
                that.setData({
                    chatMsg: {
                        openid: app.globalData.openid || wx.getStorageSync('openid'),
                        msgType: 'text',
                        userInfo: {
                            avatarUrl: wx.getStorageSync('avatarUrl'),
                            nickName: wx.getStorageSync('nickName')
                        },
                        content: that.data.content,
                        _createTime: TimeCode(),
                    }
                })
                chatroomConnnector.send({ data: JSON.stringify({
                    wxAuthCode: wx.getStorageSync('auth_code'),
                    content:that.data.content
                })})
                // const res = await sendTxt({
                //     roomId: that.data.roomId,
                //     content: that.data.content
                // })
                // console.log(res)
                // if (res.result.code == 300) {
                //     that.setData({
                //         errMsg: res.result.msg
                //     })
                // } else if (res.result.code == 403) {
                //     showMessage(res.result.msg,2000)
                // } else if (res.result.code == 200) {
                //     //todo:返回机器人的回复
                //     that.setData({
                //         chatMsg: {
                //             openid: "chatgptbot",
                //             msgType: 'text',
                //             userInfo: {
                //                 avatarUrl: '/assets/robot.png',
                //                 nickName: 'ChatAi'
                //             },
                //             content: res.result.msg,
                //             _createTime: TimeCode(),
                //         }
                //     })
                // }
            } catch (error) {
                showMessage('发送失败，网络出现问题')
                console.error(error)
                // this.setData({
                //     login: false
                // })
                wx.hideLoading();
            } finally {
                this.setData({
                    content: ''
                })
                
            }
        } else {
            try {
                wx.showLoading({
                    title: '获取用户信息',
                })
                const r = await addUser(getUser());
                that.setData({
                    login: true
                }, () => {
                    that.submit();
                })
            } catch (r) {
                showMessage('网络出现问题')
                console.e(r)
            } finally {
                wx.hideLoading();
            }
        }
    },
    async connectChatRoom(){
        try {
            const that = this
            const {socketTask} = await wx.cloud.connectContainer({
                config: {
                    env: "prod-1gj8r0g67f17c052"
                },
                service: 'flask-c8d3', // 替换自己的服务名
                path: '/chat' // 不填默认根目录
            })
            chatroomConnnector = socketTask
            socketTask.onMessage(function (event) {
                wx.hideLoading();
                const res = JSON.parse(event.data)
                console.log('【WEBSOCKET】接收消息', res)
                if (res.result.code == 300) {
                    that.setData({
                        errMsg: res.result.msg
                    })
                } else if (res.result.code == 403) {
                    showMessage(res.result.msg,2000)
                } else if (res.result.code == 200) {
                    //todo:返回机器人的回复
                    that.setData({
                        chatMsg: {
                            openid: "chatgptbot",
                            msgType: 'text',
                            userInfo: {
                                avatarUrl: '/assets/robot.png',
                                nickName: 'ChatAi'
                            },
                            content: res.result.msg,
                            _createTime: TimeCode(),
                        }
                    })
                }
              })
              socketTask.onOpen(function (res) {
                console.log('【WEBSOCKET】', '链接成功！')
                
              })
              socketTask.onClose(function (res) {
                console.log('【WEBSOCKET】链接关闭！')
                showMessage("聊天室连接失败")
                wx.hideLoading();
              })
        } catch (error) {
            console.e(error)
            showMessage("聊天室连接失败")
        }
    },
    /**
     * 生命周期函数--监听页面加载
     */
    onLoad: function async (options) {
        checkLoginState().then(res => {
            const l = res.result.code == 200;
            console.log(res,l ? '--已登录--' : '--未登录--');
            // if(!l)  wx.setStorageSync('auth_code','')
            this.setData({
                login: l
            })
        }).catch(res => {
            showMessage('网络出现问题')
            console.log(res, '--未登录1--');
            // wx.setStorageSync('auth_code','')
            this.setData({
                login: false
            })
        });
        this.connectChatRoom()
    },
    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady: function () {

    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow: function () {

    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide: function () {

    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload: function () {
    },

    /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh: function () {

    },

    /**
     * 页面上拉触底事件的处理函数
     */
    onReachBottom: function () {

    },

    /**
     * 用户点击右上角分享
     */
    onShareAppMessage: function () {

    },
    selectVoice() {
        showMessage('该功能未上线！')
    },
    selectShare() {
        showMessage('该功能未上线！')
    },
    selectAdd() {
        showMessage('该功能未上线！')
    },

})