package ru.cs.korotaev.CollaborativeTextEditor.config

import org.springframework.context.annotation.Configuration
import org.springframework.messaging.Message
import org.springframework.messaging.MessageChannel
import org.springframework.messaging.simp.config.MessageBrokerRegistry
import org.springframework.messaging.simp.stomp.StompCommand
import org.springframework.messaging.simp.stomp.StompHeaderAccessor
import org.springframework.messaging.support.ChannelInterceptor
import org.springframework.messaging.support.MessageHeaderAccessor
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker
import org.springframework.web.socket.config.annotation.StompEndpointRegistry
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer
import org.springframework.messaging.simp.config.ChannelRegistration
import ru.cs.korotaev.CollaborativeTextEditor.service.JwtService

@Configuration
@EnableWebSocketMessageBroker
class WebSocketConfig(
    private val jwtService: JwtService,
    private val userDetailsService: UserDetailsService
) : WebSocketMessageBrokerConfigurer {

    override fun configureMessageBroker(config: MessageBrokerRegistry) {
        config.enableSimpleBroker("/topic")
        config.setApplicationDestinationPrefixes("/app")
    }

    override fun registerStompEndpoints(registry: StompEndpointRegistry) {
        registry.addEndpoint("/ws").setAllowedOrigins("http://front-end", "http://localhost", "http://localhost:3000").withSockJS()
            .setStreamBytesLimit(1024 * 1024)
            .setHttpMessageCacheSize(1000)
            .setDisconnectDelay(60000)
    }

    override fun configureClientInboundChannel(registration: ChannelRegistration) {
        registration.interceptors(object : ChannelInterceptor {
            override fun preSend(message: Message<*>, channel: MessageChannel): Message<*> {
                val accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor::class.java)
                if (accessor?.command == StompCommand.CONNECT) {
                    val authHeader = accessor.getFirstNativeHeader("Authorization")
                    if (authHeader != null && authHeader.startsWith("Bearer ")) {
                        val jwt = authHeader.substring(7)
                        val username = jwtService.extractUsername(jwt)
                        val userDetails = userDetailsService.loadUserByUsername(username)
                        if (jwtService.isTokenValid(jwt, userDetails)) {
                            val auth = UsernamePasswordAuthenticationToken(userDetails, null, userDetails.authorities)
                            SecurityContextHolder.getContext().authentication = auth
                        }
                    }
                }
                return message
            }
        })
    }

}